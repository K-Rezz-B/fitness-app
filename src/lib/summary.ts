import "server-only";
import { getActivity, getPlans, getWorkouts } from "./data";
import { computeStats } from "./stats";
import { remainingThisWeek } from "./notifications";
import { upcomingPlan } from "./coach-plan";
import { TZ, WEEKDAYS, typeInfo } from "./constants";
import { dayKey, isoWeekday, today } from "./dates";
import type { Profile } from "./schema";

const nowHHMM = () =>
  new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date());

/** Résumé compact du profil pour le widget (Scriptable) et les intégrations. */
export async function buildSummary(p: Profile, origin: string) {
  const [all, plans, activity] = await Promise.all([getWorkouts(p.id), getPlans(p.id), getActivity(p.id, 1)]);
  const s = computeStats(all, p.weeklySessionsTarget);
  const t = today();
  const wd = isoWeekday(t);
  const hhmm = nowHHMM();
  const active = plans.filter((x) => x.active);
  const doneToday = all.filter((w) => dayKey(w.date) === t);
  const sameCat = (a: string, b: string) => typeInfo(a).category === typeInfo(b).category;

  const todayPlans = active
    .filter((x) => x.weekday === wd)
    .map((x) => ({ time: x.time, title: x.title, emoji: typeInfo(x.type).emoji, done: doneToday.some((w) => sameCat(w.type, x.type)) }));

  // Prochain créneau à venir (dans les 7 jours, aujourd'hui après l'heure actuelle inclus)
  const next = upcomingPlan(active, wd, hhmm);
  const upcoming = next ? { x: next.plan, inDays: next.inDays } : undefined;

  const last = all[0];
  return {
    profile: { name: p.name, emoji: p.emoji },
    score: s.score,
    level: s.level,
    xp: s.xp,
    levelProgress: Math.round(s.levelProgress * 100) / 100,
    week: { sessions: s.current.sessions, target: s.weeklyTarget, minutes: s.current.minutes, remaining: remainingThisWeek(s) },
    streak: { days: s.dayStreak, weeks: s.weekStreak },
    workedOutToday: doneToday.length > 0,
    activity: activity[0]?.date === t ? { steps: activity[0].steps, activeKcal: activity[0].activeKcal, stepsGoal: p.stepsGoal, moveGoalKcal: p.moveGoalKcal } : null,
    today: todayPlans,
    next: upcoming
      ? {
          title: upcoming.x.title,
          emoji: typeInfo(upcoming.x.type).emoji,
          time: upcoming.x.time,
          day: upcoming.inDays === 0 ? "Aujourd'hui" : upcoming.inDays === 1 ? "Demain" : WEEKDAYS[upcoming.x.weekday - 1],
          inDays: upcoming.inDays,
        }
      : null,
    lastWorkout: last
      ? { title: last.title, emoji: typeInfo(last.type).emoji, date: last.date.toISOString(), durationMin: last.durationMin }
      : null,
    url: origin,
    updatedAt: new Date().toISOString(),
  };
}

export type Summary = Awaited<ReturnType<typeof buildSummary>>;
