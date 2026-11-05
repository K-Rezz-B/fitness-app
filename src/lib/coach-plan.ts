import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "./db";
import { plans, profile, type Plan, type Profile, type Workout } from "./schema";
import { getPlans, getWorkouts } from "./data";
import { computeStats } from "./stats";
import { planWeek, prescribe, recentMaxLoads, PHASES, type Equipment, type Goal, type Level, type PlannerPrefs, type Prescription, type WeekPlan } from "./planner";
import { templateById } from "./templates";
import { typeInfo, WEEKDAYS } from "./constants";
import { addDays, dayKey, diffDays, today } from "./dates";

export const prefsOf = (p: Profile): PlannerPrefs => ({
  days: p.planDays,
  time: p.planTime,
  sessionMin: p.planSessionMin,
  equipment: p.planEquipment as Equipment,
  level: p.planLevel as Level,
  sports: p.planSports,
});

export const hasPlannerPrefs = (p: Profile) => p.planDays.length > 0;

/** Index de la semaine dans le cycle (0-3 = mise en route, progression, pic, décharge). */
export const phaseOf = (p: Profile, ws: string | null) =>
  p.planCycleStart && ws ? (((Math.floor(diffDays(ws, p.planCycleStart) / 7) % 4) + 4) % 4) : 0;

/** Séances du coach réalisées la semaine `ws` (même catégorie, même jour). */
export function adherenceOf(coachPlans: Plan[], workouts: Workout[], ws: string) {
  const planned = coachPlans.filter((x) => x.active);
  if (!planned.length) return null;
  const done = planned.filter((x) => {
    const k = addDays(ws, x.weekday - 1);
    return workouts.some((w) => dayKey(w.date) === k && typeInfo(w.type).category === typeInfo(x.type).category);
  }).length;
  return { done, planned: planned.length };
}

/**
 * Génère (ou régénère) le programme du coach pour la semaine commençant le lundi `ws`.
 * Les créneaux ajoutés à la main sont gardés : ils comptent dans l'objectif et leurs jours sont exclus.
 */
export async function generatePlan(p: Profile, ws: string): Promise<WeekPlan> {
  const [workouts, current] = await Promise.all([getWorkouts(p.id), getPlans(p.id)]);
  const coachPlans = current.filter((x) => x.source === "coach");
  const manual = current.filter((x) => x.source !== "coach" && x.active);
  const prevWs = coachPlans[0]?.weekStart ?? null;
  const adherence = prevWs && prevWs < ws ? adherenceOf(coachPlans, workouts, prevWs) : null;
  const stats = computeStats(workouts, p.weeklySessionsTarget);
  const cycleStart = !p.planCycleStart || p.planCycleStart > ws ? ws : p.planCycleStart;
  const prefs = prefsOf(p);
  const target = p.weeklySessionsTarget - manual.length;

  let plan: WeekPlan;
  if (target <= 0) {
    plan = { phase: 0, easyWeek: false, sessions: [], notes: ["Tes créneaux perso couvrent déjà ton objectif de la semaine : rien à ajouter."] };
  } else {
    const manualDays = new Set(manual.map((x) => x.weekday));
    const free = prefs.days.filter((d) => !manualDays.has(d));
    plan = planWeek({
      goal: p.goal as Goal,
      weeklyTarget: target,
      prefs: { ...prefs, days: free.length ? free : prefs.days },
      weekIndex: Math.floor(diffDays(ws, cycleStart) / 7),
      // Ratio aigu/chronique fiable seulement avec un historique (≥ 3 semaines actives sur 4)
      acwr: stats.weeks.slice(-4).filter((w) => w.sessions > 0).length >= 3 ? stats.acwr : null,
      adherence,
    });
    if (manual.length)
      plan.notes.push(`Tes créneaux perso sont gardés et comptés (${manual.map((x) => `${x.title} le ${WEEKDAYS[x.weekday - 1].toLowerCase()}`).join(", ")}).`);
  }

  await db.transaction(async (tx) => {
    await tx.delete(plans).where(and(eq(plans.profileId, p.id), eq(plans.source, "coach")));
    if (plan.sessions.length)
      await tx.insert(plans).values(
        plan.sessions.map((s) => ({
          profileId: p.id,
          source: "coach",
          title: s.title,
          type: s.type,
          weekday: s.weekday,
          time: s.time,
          durationMin: s.durationMin,
          reminderMin: 30,
          templateId: s.templateId,
          rpe: s.rpe,
          notes: s.why,
          weekStart: ws,
        })),
      );
    await tx.update(profile).set({ planCycleStart: cycleStart, planNotes: plan.notes, planEasy: plan.easyWeek }).where(eq(profile.id, p.id));
  });
  return plan;
}

/** Exercices prescrits pour un créneau du coach (séries, reps, charge conseillée). */
export function prescriptionFor(p: Profile, plan: Plan, workouts: Workout[]): Prescription[] | null {
  const t = plan.templateId ? templateById(plan.templateId) : undefined;
  if (!t) return null;
  return prescribe(t, {
    phase: phaseOf(p, plan.weekStart),
    easyWeek: p.planEasy,
    level: p.planLevel as Level,
    durationMin: plan.durationMin,
    loads: recentMaxLoads(workouts, today()),
  });
}

export const fmtPrescription = (e: Prescription) =>
  `${e.name} · ${e.sets > 1 ? `${e.sets} × ` : ""}${e.reps}${e.weightKg ? ` @ ${String(e.weightKg).replace(".", ",")} kg` : ""}`;

/** Exercices des créneaux du coach, pour la description des événements Calendrier. */
export function calendarDetails(p: Profile, list: Plan[], workouts: Workout[]) {
  const map = new Map<number, string[]>();
  for (const pl of list) {
    const rx = pl.source === "coach" ? prescriptionFor(p, pl, workouts) : null;
    if (rx) map.set(pl.id, rx.map((e) => `• ${fmtPrescription(e)}`));
  }
  return map;
}

export const phaseLabel = (p: Profile, ws: string | null) => {
  const ph = phaseOf(p, ws);
  return `Semaine ${ph + 1}/4 · ${PHASES[ph].label}${p.planEasy && ph !== 3 ? " (allégée)" : ""}`;
};
