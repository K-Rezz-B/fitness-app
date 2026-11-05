import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte } from "drizzle-orm";
import { db } from "./db";
import { passkeys, plans, profile, pushSubscriptions, videos, weights, workouts } from "./schema";
import { dayKey, today, weekStart } from "./dates";

/** Toutes les lectures sont filtrées par profil : le paramètre `pid` est obligatoire. */
export const listProfiles = cache(() => db.select().from(profile).orderBy(asc(profile.id)));
export const getWorkouts = (pid: number) =>
  db.select().from(workouts).where(eq(workouts.profileId, pid)).orderBy(desc(workouts.date));
export const getWorkout = async (pid: number, id: number) =>
  (await db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.profileId, pid))))[0];
export const getWeights = (pid: number) =>
  db.select().from(weights).where(eq(weights.profileId, pid)).orderBy(desc(weights.date), desc(weights.id));
export const getPlans = (pid: number) =>
  db.select().from(plans).where(eq(plans.profileId, pid)).orderBy(asc(plans.weekday), asc(plans.time));
export const getVideos = (pid: number) =>
  db.select().from(videos).where(eq(videos.profileId, pid)).orderBy(desc(videos.favorite), desc(videos.createdAt));
export const getPasskeys = (pid: number) =>
  db.select().from(passkeys).where(eq(passkeys.profileId, pid)).orderBy(desc(passkeys.createdAt));
export const getPushSubscriptions = (pid: number) =>
  db.select().from(pushSubscriptions).where(eq(pushSubscriptions.profileId, pid)).orderBy(desc(pushSubscriptions.createdAt));

/** Séances de la semaine en cours (requête légère pour la pastille d'icône) */
export async function countThisWeek(pid: number) {
  const ws = weekStart(today());
  const rows = await db
    .select({ date: workouts.date })
    .from(workouts)
    .where(and(eq(workouts.profileId, pid), gte(workouts.date, new Date(Date.now() - 8 * 86_400_000))));
  return rows.filter((r) => dayKey(r.date) >= ws).length;
}
