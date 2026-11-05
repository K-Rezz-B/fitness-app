"use server";
// Server actions du coach planificateur.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { plans, profile } from "@/lib/schema";
import { requireProfile } from "@/lib/session";
import { generatePlan } from "@/lib/coach-plan";
import { cleanDays, EQUIPMENT, LEVELS, PLANNER_SPORTS } from "@/lib/planner";
import { today, weekStart } from "@/lib/dates";

const SESSION_MIN = [30, 45, 60, 75, 90];

/** Questionnaire → préférences enregistrées → programme de la semaine en cours généré. */
export async function savePlannerPrefs(f: FormData) {
  const me = await requireProfile();
  const days = cleanDays(f.getAll("days").map(Number));
  if (!days.length) throw new Error("Choisis au moins un jour");
  const time = String(f.get("time") ?? "");
  const minutes = Number(f.get("sessionMin"));
  const equipment = String(f.get("equipment"));
  const level = String(f.get("level"));
  const values = {
    planDays: days,
    planTime: /^\d{2}:\d{2}$/.test(time) ? time : "18:30",
    planSessionMin: SESSION_MIN.includes(minutes) ? minutes : 45,
    planEquipment: equipment in EQUIPMENT ? equipment : "gym",
    planLevel: level in LEVELS ? level : "beginner",
    planSports: f.getAll("sports").map(String).filter((s) => (PLANNER_SPORTS as readonly string[]).includes(s)),
    planAuto: f.get("auto") === "on",
    updatedAt: new Date(),
  };
  await db.update(profile).set(values).where(eq(profile.id, me.id));
  await generatePlan({ ...me, ...values }, weekStart(today()));
  revalidatePath("/", "layout");
  redirect("/planning#coach");
}

export async function regeneratePlan() {
  const me = await requireProfile();
  await generatePlan(me, weekStart(today()));
  revalidatePath("/", "layout");
}

/** Retire les séances du coach (les créneaux perso restent) et coupe la re-planification auto. */
export async function removeCoachPlan() {
  const me = await requireProfile();
  await db.delete(plans).where(and(eq(plans.profileId, me.id), eq(plans.source, "coach")));
  await db.update(profile).set({ planAuto: false, planNotes: [] }).where(eq(profile.id, me.id));
  revalidatePath("/", "layout");
}
