"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, profile, videos, weights, workouts, type Exercise } from "@/lib/schema";
import { SESSION_COOKIE, checkPassword, sessionToken } from "@/lib/auth";
import { after } from "next/server";
import { COOKIE_OPTS, PROFILE_COOKIE, requireAuth, requireProfile } from "@/lib/session";
import { notifyNewBadges } from "@/lib/push";
import { detectPlatform } from "@/lib/video";
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

export async function selectProfile(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  const [p] = id ? await db.select({ id: profile.id }).from(profile).where(eq(profile.id, id)) : [];
  if (!p) redirect("/profiles");
  (await cookies()).set(PROFILE_COOKIE, String(p.id), COOKIE_OPTS);
  revalidateAll();
  redirect("/");
}

export async function createProfile(f: FormData) {
  await requireAuth();
  const name = str(f, "name").slice(0, 60);
  if (!name) throw new Error("Prénom requis");
  const [p] = await db.insert(profile).values({ name, emoji: emojiOf(f) }).returning({ id: profile.id });
  (await cookies()).set(PROFILE_COOKIE, String(p.id), COOKIE_OPTS);
  revalidateAll();
  redirect("/profile?welcome=1");
}

export async function deleteProfile(f: FormData) {
  const me = await requireProfile();
  if (f.get("confirm") !== "on") throw new Error("Confirmation requise");
  await db.delete(profile).where(eq(profile.id, me.id)); // cascade : séances, pesées, planning, vidéos
  (await cookies()).delete(PROFILE_COOKIE);
  revalidateAll();
  redirect("/profiles");
}

// ---------- séances ----------
export async function saveWorkout(f: FormData) {
  const me = await requireProfile();
  const pid = me.id;
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
  const id = idOf(f);
  if (id) await db.update(workouts).set(values).where(and(eq(workouts.id, id), eq(workouts.profileId, pid)));
  else {
    const [row] = await db.insert(workouts).values({ ...values, profileId: pid }).returning({ id: workouts.id });
    after(() => notifyNewBadges(me, row.id)); // push « nouveau badge » sur les autres appareils
  }
  revalidateAll();
  redirect(id ? "/workouts" : "/?saved=1");
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
