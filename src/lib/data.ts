import "server-only";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { plans, profile, videos, weights, workouts } from "./schema";

export const getProfile = async () => (await db.select().from(profile).where(eq(profile.id, 1)))[0];
export const getWorkouts = () => db.select().from(workouts).orderBy(desc(workouts.date));
export const getWorkout = async (id: number) => (await db.select().from(workouts).where(eq(workouts.id, id)))[0];
export const getWeights = () => db.select().from(weights).orderBy(desc(weights.date), desc(weights.id));
export const getPlans = () => db.select().from(plans).orderBy(asc(plans.weekday), asc(plans.time));
export const getVideos = () => db.select().from(videos).orderBy(desc(videos.favorite), desc(videos.createdAt));
