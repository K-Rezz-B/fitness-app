"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, profile, videos, weights, workouts, type Exercise } from "@/lib/schema";
import { SESSION_COOKIE, checkPassword, sessionToken } from "@/lib/auth";
import { requireAuth } from "@/lib/session";
import { detectPlatform } from "@/lib/video";
import { TYPE_BY_ID } from "@/lib/constants";

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

// ---------- auth ----------
export async function login(_prev: string | null, f: FormData): Promise<string | null> {
  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET)
    return "Configure APP_PASSWORD et AUTH_SECRET dans Vercel.";
  if (!(await checkPassword(str(f, "password")))) {
    await new Promise((r) => setTimeout(r, 600)); // ralentit le brute-force
    return "Mot de passe incorrect";
  }
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

// ---------- séances ----------
export async function saveWorkout(f: FormData) {
  await requireAuth();
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
    videoId: num(f, "videoId"),
    exercises,
  };
  const id = idOf(f);
  if (id) await db.update(workouts).set(values).where(eq(workouts.id, id));
  else await db.insert(workouts).values(values);
  revalidateAll();
  redirect(id ? "/workouts" : "/?saved=1");
}

export async function deleteWorkout(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  if (id) await db.delete(workouts).where(eq(workouts.id, id));
  revalidateAll();
  redirect("/workouts");
}

// ---------- planning ----------
export async function savePlan(f: FormData) {
  await requireAuth();
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
  if (id) await db.update(plans).set(values).where(eq(plans.id, id));
  else await db.insert(plans).values(values);
  revalidateAll();
}

export async function togglePlan(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  if (id) await db.update(plans).set({ active: sql`not ${plans.active}`, updatedAt: new Date() }).where(eq(plans.id, id));
  revalidateAll();
}

export async function deletePlan(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  if (id) await db.delete(plans).where(eq(plans.id, id));
  revalidateAll();
}

// ---------- vidéos ----------
export async function saveVideo(f: FormData) {
  await requireAuth();
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
  if (id) await db.update(videos).set(values).where(eq(videos.id, id));
  else await db.insert(videos).values(values);
  revalidateAll();
}

export async function toggleFavorite(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  if (id) await db.update(videos).set({ favorite: sql`not ${videos.favorite}` }).where(eq(videos.id, id));
  revalidateAll();
}

export async function deleteVideo(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  if (id) await db.delete(videos).where(eq(videos.id, id));
  revalidateAll();
}

// ---------- profil & poids ----------
export async function saveProfile(f: FormData) {
  await requireAuth();
  const birth = str(f, "birthDate");
  const values = {
    name: str(f, "name").slice(0, 60),
    sex: str(f, "sex") === "female" ? "female" : "male",
    birthDate: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null,
    heightCm: num(f, "heightCm"),
    activityLevel: str(f, "activityLevel") || "moderate",
    goal: str(f, "goal") || "maintain",
    targetWeightKg: num(f, "targetWeightKg"),
    weeklySessionsTarget: clamp(Math.round(num(f, "weeklySessionsTarget") ?? 3), 1, 14),
    updatedAt: new Date(),
  };
  await db.insert(profile).values({ id: 1, ...values }).onConflictDoUpdate({ target: profile.id, set: values });
  revalidateAll();
}

export async function addWeight(f: FormData) {
  await requireAuth();
  const kg = num(f, "weightKg");
  const date = str(f, "date");
  if (!kg || kg < 20 || kg > 400 || !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Poids invalide");
  const bf = num(f, "bodyFatPct");
  await db.insert(weights).values({ date, weightKg: kg, bodyFatPct: bf && bf > 0 && bf < 70 ? bf : null });
  revalidateAll();
}

export async function deleteWeight(f: FormData) {
  await requireAuth();
  const id = idOf(f);
  if (id) await db.delete(weights).where(eq(weights.id, id));
  revalidateAll();
}
