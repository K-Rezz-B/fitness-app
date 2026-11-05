import "server-only";
import { cache } from "react";
import { and, asc, desc, eq, gte, inArray, lt } from "drizzle-orm";
import { db } from "./db";
import { dailyActivity, passkeys, plans, profile, pushSubscriptions, videos, weights, workouts } from "./schema";
import { addDays, dayKey, today, weekStart } from "./dates";

/** Toutes les lectures sont filtrées par profil : le paramètre `pid` est obligatoire. */
export const listProfiles = cache(() => db.select().from(profile).orderBy(asc(profile.id)));
export const getWorkouts = (pid: number) =>
  db.select().from(workouts).where(eq(workouts.profileId, pid)).orderBy(desc(workouts.date));
export const getWorkout = async (pid: number, id: number) =>
  (await db.select().from(workouts).where(and(eq(workouts.id, id), eq(workouts.profileId, pid))))[0];
export const getWeights = (pid: number) =>
  db.select().from(weights).where(eq(weights.profileId, pid)).orderBy(desc(weights.date), desc(weights.id));
export const getPlan = async (pid: number, id: number) =>
  (await db.select().from(plans).where(and(eq(plans.id, id), eq(plans.profileId, pid))))[0];
export const getPlans = (pid: number) =>
  db.select().from(plans).where(eq(plans.profileId, pid)).orderBy(asc(plans.weekday), asc(plans.time));
export const getVideos = (pid: number) =>
  db.select().from(videos).where(eq(videos.profileId, pid)).orderBy(desc(videos.favorite), desc(videos.createdAt), desc(videos.id));
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

/** Activité quotidienne (app Forme) des `days` derniers jours, du plus récent au plus ancien */
export const getActivity = (pid: number, days = 30) =>
  db
    .select()
    .from(dailyActivity)
    .where(and(eq(dailyActivity.profileId, pid), gte(dailyActivity.date, addDays(today(), -(days - 1)))))
    .orderBy(desc(dailyActivity.date));

/**
 * Défis : profils qui ont choisi d'y participer et leurs séances sur [from, to[.
 * Seule lecture qui traverse les profils : limitée aux volontaires et à des champs non sensibles.
 */
export async function getChallengeBoard(from: Date, to: Date) {
  const people = await db
    .select({ id: profile.id, name: profile.name, emoji: profile.emoji, target: profile.weeklySessionsTarget })
    .from(profile)
    .where(eq(profile.shareChallenges, true))
    .orderBy(asc(profile.id));
  const rows = people.length
    ? await db
        .select({ profileId: workouts.profileId, date: workouts.date, durationMin: workouts.durationMin, rpe: workouts.rpe, type: workouts.type })
        .from(workouts)
        .where(and(inArray(workouts.profileId, people.map((p) => p.id)), gte(workouts.date, from), lt(workouts.date, to)))
    : [];
  return { people, rows };
}
