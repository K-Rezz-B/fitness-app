"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, profile, videos, weights, workouts, type Exercise, type Workout } from "@/lib/schema";
import { getWorkouts } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { newBadges } from "@/lib/notifications";
import { detectRecords, exerciseIndex, exerciseMemos } from "@/lib/records";
import { SESSION_COOKIE, checkPassword, sessionToken } from "@/lib/auth";
import { after } from "next/server";
import { COOKIE_OPTS, PROFILE_COOKIE, getActiveProfile, requireAuth, requireProfile, setUnlockedProfile } from "@/lib/session";
import { checkProfilePin, hashPin, newPinError } from "@/lib/pin";
import type { FormState } from "@/components/action-form";
import { notifyNewBadges } from "@/lib/push";
import { detectPlatform, youtubeId } from "@/lib/video";
import { CHANNELS, VIDEO_CATALOG, catalogUrl } from "@/lib/video-catalog";
import { PROFILE_EMOJIS, TYPE_BY_ID } from "@/lib/constants";

// ---------- helpers ----------
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => {
  const v = str(f, k).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
const idOf = (f: FormData) => {
  const n = Number(f.get("id"));
  return Number.isInteger(n) && n > 0 ? n : null;
};
function revalidateAll() {
  revalidatePath("/", "layout");
}
/** id du profil actif (redirige vers le sélecteur s'il n'y en a pas) */
const currentPid = async () => (await requireProfile()).id;

// ---------- auth ----------
export async function login(_prev: string | null, f: FormData): Promise<string | null> {
  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET)
    return "Configure APP_PASSWORD et AUTH_SECRET dans Vercel.";
  if (!(await checkPassword(str(f, "password")))) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit le brute-force
    return "Mot de passe incorrect";
  }
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), COOKIE_OPTS);
  redirect("/");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(PROFILE_COOKIE);
  redirect("/login");
}

// ---------- profils ----------
const emojiOf = (f: FormData) => (PROFILE_EMOJIS.includes(str(f, "emoji")) ? str(f, "emoji") : PROFILE_EMOJIS[0]);

const fail = (message: string): FormState => ({ ok: false, message });
const newPinErrorOf = (f: FormData) => newPinError(str(f, "pin"), str(f, "pinConfirm"));

/** Création : le code PIN est obligatoire, le profil est ouvert d'office sur cet appareil. */
export async function createProfile(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const name = str(f, "name").slice(0, 60);
  if (!name) return fail("Prénom requis.");
  const err = newPinErrorOf(f);
  if (err) return fail(err);
  const pinHash = await hashPin(str(f, "pin"));
  const [p] = await db.insert(profile).values({ name, emoji: emojiOf(f), pinHash }).returning({ id: profile.id, pinHash: profile.pinHash });
  await setUnlockedProfile(p);
  revalidateAll();
  redirect("/profile?welcome=1");
}

/** Ouvre un profil verrouillé avec son code (essais limités, voir checkProfilePin). */
export async function unlockWithPin(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const id = idOf(f);
  if (!id) return fail("Profil introuvable.");
  const r = await checkProfilePin(id, str(f, "pin"));
  if (!r.ok) return fail(r.error);
  await setUnlockedProfile({ id, pinHash: r.pinHash });
  revalidateAll();
  redirect("/");
}

/** Profil créé avant le verrou : la première ouverture impose de choisir son code. */
export async function definePin(_prev: FormState, f: FormData): Promise<FormState> {
  await requireAuth();
  const id = idOf(f);
  const err = newPinErrorOf(f);
  if (err) return fail(err);
  const pinHash = await hashPin(str(f, "pin"));
  // `pin_hash IS NULL` dans le WHERE : impossible d'écraser le code d'un profil déjà protégé
  const [p] = id
    ? await db
        .update(profile)
        .set({ pinHash, pinFailedAttempts: 0, pinLockedUntil: null })
        .where(and(eq(profile.id, id), isNull(profile.pinHash)))
        .returning({ id: profile.id, pinHash: profile.pinHash })
    : [];
  if (!p) return fail("Ce profil a déjà un code : déverrouille-le.");
  await setUnlockedProfile(p);
  revalidateAll();
  redirect("/profile?pin=1");
}

/** Change le code (l'ancien est exigé) ; les autres appareils sont reverrouillés. */
export async function changePin(_prev: FormState, f: FormData): Promise<FormState> {
  const me = await requireProfile();
  const err = newPinErrorOf(f);
  if (err) return fail(err);
  const r = await checkProfilePin(me.id, str(f, "currentPin"));
  if (!r.ok) return fail(r.error);
  const pinHash = await hashPin(str(f, "pin"));
  await db.update(profile).set({ pinHash }).where(eq(profile.id, me.id));
  await setUnlockedProfile({ id: me.id, pinHash });
  revalidateAll();
  return { ok: true, message: "Code modifié. Tes autres appareils devront le saisir à nouveau." };
}

/** Referme le profil sur cet appareil (retour au sélecteur). */
export async function lockProfile() {
  (await cookies()).delete(PROFILE_COOKIE);
  revalidateAll();
  redirect("/profiles");
}

export async function deleteProfile(_prev: FormState, f: FormData): Promise<FormState> {
  const me = await requireProfile();
  if (f.get("confirm") !== "on") return fail("Coche la case de confirmation.");
  const r = await checkProfilePin(me.id, str(f, "pin"));
  if (!r.ok) return fail(r.error);
  await db.delete(profile).where(eq(profile.id, me.id)); // cascade : séances, pesées, planning, vidéos
  (await cookies()).delete(PROFILE_COOKIE);
  revalidateAll();
  redirect("/profiles");
}

// ---------- séances ----------
/** Champs d'une séance lus depuis le formulaire (partagé par l'enregistrement direct et la synchro hors-ligne). */
async function workoutValues(pid: number, f: FormData) {
  const type = str(f, "type");
  if (!TYPE_BY_ID[type]) throw new Error("Type inconnu");
  let exercises: Exercise[] = [];
  try {
    const parsed = JSON.parse(str(f, "exercises") || "[]");
    if (Array.isArray(parsed))
      exercises = parsed
        .filter((e) => e && typeof e.name === "string" && e.name.trim())
        .slice(0, 50)
        .map((e) => ({
          name: String(e.name).slice(0, 120),
          sets: (Array.isArray(e.sets) ? e.sets : []).slice(0, 30).map((s: { reps?: unknown; weight?: unknown }) => ({
            reps: Number.isFinite(Number(s?.reps)) && s?.reps !== "" && s?.reps != null ? Number(s.reps) : undefined,
            weight: Number.isFinite(Number(s?.weight)) && s?.weight !== "" && s?.weight != null ? Number(s.weight) : undefined,
          })),
        }));
  } catch {}
  const date = new Date(str(f, "date"));
  const values = {
    type,
    title: str(f, "title").slice(0, 120) || TYPE_BY_ID[type].label,
    date: isNaN(date.getTime()) ? new Date() : date,
    durationMin: clamp(Math.round(num(f, "durationMin") ?? 45), 1, 1440),
    rpe: clamp(Math.round(num(f, "rpe") ?? 6), 1, 10),
    distanceKm: num(f, "distanceKm"),
    calories: num(f, "calories") !== null ? Math.round(num(f, "calories")!) : null,
    notes: str(f, "notes").slice(0, 2000) || null,
    videoId: await ownVideoId(pid, num(f, "videoId")),
    exercises,
  };
  return values;
}

export async function saveWorkout(f: FormData) {
  const me = await requireProfile();
  const pid = me.id;
  const values = await workoutValues(pid, f);
  const id = idOf(f);
  if (id) {
    await db.update(workouts).set(values).where(and(eq(workouts.id, id), eq(workouts.profileId, pid)));
    revalidateAll();
    redirect("/workouts");
  }
  const history = await getWorkouts(pid);
  const [row] = await db.insert(workouts).values({ ...values, profileId: pid }).returning();
  after(() => notifyNewBadges(me, row.id)); // push « nouveau badge » sur les autres appareils
  revalidateAll();
  redirect(`/?${celebrationParams(me.weeklySessionsTarget, history, row)}`);
}

/**
 * Séance saisie sans réseau puis envoyée au retour de la connexion (voir <OutboxSync>).
 * `clientId` sert de clé de dédoublonnage : renvoyer deux fois la même séance ne crée qu'une ligne.
 */
export async function syncOfflineWorkout(pidAtCapture: number, clientId: string, fields: Record<string, string>) {
  await requireAuth();
  const me = await getActiveProfile();
  // Séance saisie sur un autre profil : on la garde en attente jusqu'à ce que ce profil soit ouvert
  if (!me || me.id !== pidAtCapture) return { ok: false as const, reason: "profile" as const };
  if (!/^[\w-]{8,64}$/.test(clientId)) return { ok: true as const }; // entrée corrompue : on l'abandonne
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) if (typeof v === "string") f.set(k, v);
  f.delete("id");
  const values = await workoutValues(me.id, f).catch(() => null);
  if (!values) return { ok: true as const };
  const [row] = await db
    .insert(workouts)
    .values({ ...values, profileId: me.id, externalId: `offline:${clientId}` })
    .onConflictDoNothing()
    .returning({ id: workouts.id });
  if (row) after(() => notifyNewBadges(me, row.id));
  revalidateAll();
  return { ok: true as const };
}

/** Ce qu'on fête sur l'accueil après une nouvelle séance : niveau, badges, records (lu par <Celebration>). */
function celebrationParams(target: number, history: Workout[], row: Workout) {
  const before = computeStats(history, target);
  const after = computeStats([row, ...history], target);
  const q = new URLSearchParams({ saved: "1", xp: String(after.xp - before.xp) });
  if (after.level > before.level) q.set("lvl", String(after.level));
  const fresh = newBadges(before, after);
  if (fresh.length) q.set("b", fresh.map((b) => b.id).join(","));
  const prs = detectRecords(exerciseMemos(exerciseIndex(history)), row.exercises).slice(0, 3);
  if (prs.length) q.set("pr", JSON.stringify(prs));
  return q.toString();
}

/** N'accepte qu'une vidéo du profil (évite de lier/afficher la vidéo d'un autre profil). */
async function ownVideoId(pid: number, videoId: number | null) {
  if (!videoId || !Number.isInteger(videoId)) return null;
  const [v] = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.profileId, pid)));
  return v?.id ?? null;
}

export async function deleteWorkout(f: FormData) {
  const pid = await currentPid();
  const id = idOf(f);
  if (id) await db.delete(workouts).where(and(eq(workouts.id, id), eq(workouts.profileId, pid)));
  revalidateAll();
  redirect("/workouts");
}

// ---------- défis ----------
export async function toggleChallenges() {
  const me = await requireProfile();
  await db.update(profile).set({ shareChallenges: !me.shareChallenges, updatedAt: new Date() }).where(eq(profile.id, me.id));
  revalidateAll();
}

// ---------- planning ----------
export async function savePlan(f: FormData) {
  const pid = await currentPid();
  const type = str(f, "type");
  const time = str(f, "time");
  if (!TYPE_BY_ID[type] || !/^\d{2}:\d{2}$/.test(time)) throw new Error("Données invalides");
  const values = {
    title: str(f, "title").slice(0, 120) || TYPE_BY_ID[type].label,
    type,
    weekday: clamp(Math.round(num(f, "weekday") ?? 1), 1, 7),
    time,
    durationMin: clamp(Math.round(num(f, "durationMin") ?? 60), 5, 600),
    reminderMin: clamp(Math.round(num(f, "reminderMin") ?? 30), 0, 1440),
    updatedAt: new Date(),
  };
  const id = idOf(f);
  if (id) await db.update(plans).set(values).where(and(eq(plans.id, id), eq(plans.profileId, pid)));
  else await db.insert(plans).values({ ...values, profileId: pid });
  revalidateAll();
}

export async function togglePlan(f: FormData) {
  const pid = await currentPid();
  const id = idOf(f);
  if (id)
    await db
      .update(plans)
      .set({ active: sql`not ${plans.active}`, updatedAt: new Date() })
      .where(and(eq(plans.id, id), eq(plans.profileId, pid)));
  revalidateAll();
}

export async function deletePlan(f: FormData) {
  const pid = await currentPid();
  const id = idOf(f);
  if (id) await db.delete(plans).where(and(eq(plans.id, id), eq(plans.profileId, pid)));
  revalidateAll();
}

// ---------- vidéos ----------
export async function saveVideo(f: FormData) {
  const pid = await currentPid();
  const url = str(f, "url");
  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw 0;
  } catch {
    throw new Error("URL invalide");
  }
  const tags = Array.from(
    new Set(
      str(f, "tags")
        .split(/[,#]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean)
        .map((t) => t.slice(0, 30)),
    ),
  ).slice(0, 15);
  const values = {
    url,
    title: str(f, "title").slice(0, 160) || url,
    platform: detectPlatform(url),
    tags,
    type: TYPE_BY_ID[str(f, "type")] ? str(f, "type") : null,
    durationMin: num(f, "durationMin") !== null ? Math.round(num(f, "durationMin")!) : null,
    notes: str(f, "notes").slice(0, 1000) || null,
  };
  const id = idOf(f);
  if (id) await db.update(videos).set(values).where(and(eq(videos.id, id), eq(videos.profileId, pid)));
  else await db.insert(videos).values({ ...values, profileId: pid });
  revalidateAll();
}

/** Ajoute à la vidéothèque du profil les vidéos de la sélection du coach qu'il n'a pas encore. */
export async function importVideoSelection() {
  const pid = await currentPid();
  const have = new Set(
    (await db.select({ url: videos.url }).from(videos).where(eq(videos.profileId, pid))).map((v) => youtubeId(v.url)),
  );
  // Insérées à l'envers : la vidéothèque (plus récentes d'abord) suit l'ordre de la sélection
  const missing = VIDEO_CATALOG.filter((c) => !have.has(c.yt)).reverse();
  if (missing.length)
    await db.insert(videos).values(
      missing.map((c) => ({
        profileId: pid,
        url: catalogUrl(c),
        title: c.title,
        platform: "youtube",
        tags: c.tags,
        type: c.type,
        durationMin: c.durationMin,
        notes: CHANNELS[c.channel].name,
      })),
    );
  revalidateAll();
}

export async function toggleFavorite(f: FormData) {
  const pid = await currentPid();
  const id = idOf(f);
  if (id)
    await db
      .update(videos)
      .set({ favorite: sql`not ${videos.favorite}` })
      .where(and(eq(videos.id, id), eq(videos.profileId, pid)));
  revalidateAll();
}

export async function deleteVideo(f: FormData) {
  const pid = await currentPid();
  const id = idOf(f);
  if (id) await db.delete(videos).where(and(eq(videos.id, id), eq(videos.profileId, pid)));
  revalidateAll();
}

// ---------- profil & poids ----------
export async function saveProfile(f: FormData) {
  const pid = await currentPid();
  const birth = str(f, "birthDate");
  const values = {
    name: str(f, "name").slice(0, 60) || "Moi",
    emoji: emojiOf(f),
    sex: str(f, "sex") === "female" ? "female" : "male",
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null,
    heightCm: num(f, "heightCm"),
    activityLevel: str(f, "activityLevel") || "moderate",
    goal: str(f, "goal") || "maintain",
    targetWeightKg: num(f, "targetWeightKg"),
    weeklySessionsTarget: clamp(Math.round(num(f, "weeklySessionsTarget") ?? 3), 1, 14),
    moveGoalKcal: clamp(Math.round(num(f, "moveGoalKcal") ?? 400), 50, 3000),
    stepsGoal: clamp(Math.round(num(f, "stepsGoal") ?? 8000), 1000, 30000),
    updatedAt: new Date(),
  };
  await db.update(profile).set(values).where(eq(profile.id, pid));
  revalidateAll();
}

export async function addWeight(f: FormData) {
  const pid = await currentPid();
  const kg = num(f, "weightKg");
  const date = str(f, "date");
  if (!kg || kg < 20 || kg > 400 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Poids invalide");
  const bf = num(f, "bodyFatPct");
  await db.insert(weights).values({ profileId: pid, date, weightKg: kg, bodyFatPct: bf && bf > 0 && bf < 70 ? bf : null });
  revalidateAll();
}

export async function deleteWeight(f: FormData) {
  const pid = await currentPid();
  const id = idOf(f);
  if (id) await db.delete(weights).where(and(eq(weights.id, id), eq(weights.profileId, pid)));
  revalidateAll();
}
