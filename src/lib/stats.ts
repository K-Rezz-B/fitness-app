import type { Workout } from "./schema";
import { CATEGORIES, typeInfo, type Category } from "./constants";
import { addDays, dayKey, diffDays, hourInTZ, today, weekStart } from "./dates";

export const load = (w: Pick<Workout, "durationMin" | "rpe">) => w.durationMin * w.rpe; // sRPE (Foster 2001)
/** Minutes « équivalent modéré » OMS : une minute intense (RPE ≥ 7) compte double */
export const whoMinutes = (w: Pick<Workout, "durationMin" | "rpe">) =>
  w.rpe >= 7 ? w.durationMin * 2 : w.durationMin;

/** XP gagnée par séance : 50 + charge / 5 */
export const workoutXp = (w: Pick<Workout, "durationMin" | "rpe">) => 50 + Math.round(load(w) / 5);

export type Stats = ReturnType<typeof computeStats>;

type Scored = Pick<Workout, "durationMin" | "rpe" | "type">;

/**
 * Score de forme 0-100 au jour `t` (et ses composantes), à partir des séances indexées par jour.
 * Ne regarde que les jours ≤ t : sert aussi à reconstituer l'historique du score (page Évolution).
 */
export function formScore<T extends Scored>(byDay: ReadonlyMap<string, T[]>, weeklyTarget: number, t: string) {
  const thisWeek = weekStart(t);
  /** Séances des `n` derniers jours (t inclus), de la plus récente à la plus ancienne */
  const lastDays = (n: number) => {
    const out: T[] = [];
    for (let i = 0; i < n; i++) out.push(...(byDay.get(addDays(t, -i)) ?? []));
    return out;
  };

  // --- Série de semaines où l'objectif est atteint ---
  const sessionsInWeek = (ws: string) => {
    let n = 0;
    for (let d = 0; d < 7; d++) n += byDay.get(addDays(ws, d))?.length ?? 0;
    return n;
  };
  let weekStreak = 0;
  // la semaine en cours compte si déjà validée, sinon on part de la précédente
  let cursor = sessionsInWeek(thisWeek) >= weeklyTarget ? thisWeek : addDays(thisWeek, -7);
  while (sessionsInWeek(cursor) >= weeklyTarget && weekStreak < 520) {
    weekStreak++;
    cursor = addDays(cursor, -7);
  }

  // --- Charge aiguë / chronique (ACWR, Gabbett 2016) ---
  const last7 = lastDays(7);
  const last28 = lastDays(28);
  const acute = last7.reduce((s, w) => s + load(w), 0);
  const chronic = last28.reduce((s, w) => s + load(w), 0) / 4;
  const acwr = chronic > 0 ? acute / chronic : null;

  // --- Score de forme 0-100 ---
  const regularite = Math.min(1, last28.length / Math.max(1, weeklyTarget * 4));
  const who7 = last7.reduce((s, w) => s + whoMinutes(w), 0);
  const volume = Math.min(1, who7 / 150); // OMS : 150 min/sem modérée
  const cats14 = new Set(lastDays(14).map((w) => typeInfo(w.type).category));
  const variete = cats14.size / 3;
  const serie = Math.min(1, weekStreak / 4);
  const scoreParts = [
    { label: "Régularité", value: regularite, weight: 40, hint: `${last28.length}/${weeklyTarget * 4} séances sur 28 j` },
    { label: "Volume", value: volume, weight: 25, hint: `${who7}/150 min OMS sur 7 j` },
    { label: "Série", value: serie, weight: 20, hint: `${weekStreak} sem. d'objectif d'affilée` },
    { label: "Variété", value: variete, weight: 15, hint: `${cats14.size}/3 catégories sur 14 j` },
  ];
  const score = Math.round(scoreParts.reduce((s, p) => s + p.value * p.weight, 0));
  return { score, scoreParts, weekStreak, acute, chronic, acwr, who7, last7 };
}

export function computeStats(all: Workout[], weeklyTarget: number) {
  const t = today();
  const thisWeek = weekStart(t);
  const byDay = new Map<string, Workout[]>();
  for (const w of all) {
    const k = dayKey(w.date);
    byDay.set(k, [...(byDay.get(k) ?? []), w]);
  }
  const inRange = (from: string) => all.filter((w) => dayKey(w.date) >= from);

  // --- Semaines (12 dernières) ---
  const weeks: { week: string; sessions: number; minutes: number; load: number; byCat: Record<Category, number> }[] = [];
  for (let i = 11; i >= 0; i--) {
    const ws = addDays(thisWeek, -7 * i);
    const we = addDays(ws, 7);
    const list = all.filter((w) => {
      const k = dayKey(w.date);
      return k >= ws && k < we;
    });
    const byCat = { force: 0, cardio: 0, mobilite: 0 } as Record<Category, number>;
    for (const w of list) byCat[typeInfo(w.type).category] += w.durationMin;
    weeks.push({
      week: ws,
      sessions: list.length,
      minutes: list.reduce((s, w) => s + w.durationMin, 0),
      load: list.reduce((s, w) => s + load(w), 0),
      byCat,
    });
  }
  const current = weeks[weeks.length - 1];

  // --- Série de jours actifs (tolère aujourd'hui non encore fait) ---
  let dayStreak = 0;
  let d = byDay.has(t) ? t : addDays(t, -1);
  while (byDay.has(d)) {
    dayStreak++;
    d = addDays(d, -1);
  }

  // --- Score de forme, série de semaines, charge aiguë / chronique ---
  const { score, scoreParts, weekStreak, acute, chronic, acwr, who7, last7 } = formScore(byDay, weeklyTarget, t);

  // --- XP & niveaux ---
  const xp = all.reduce((s, w) => s + workoutXp(w), 0);
  const level = Math.floor(Math.sqrt(xp / 300)) + 1;
  const xpFor = (l: number) => 300 * (l - 1) ** 2;
  const levelProgress = (xp - xpFor(level)) / (xpFor(level + 1) - xpFor(level));

  // --- Heatmap 18 semaines ---
  const heatStart = addDays(thisWeek, -7 * 17);
  const heat: { day: string; minutes: number; count: number }[] = [];
  for (let k = heatStart; k <= addDays(thisWeek, 6); k = addDays(k, 1)) {
    const list = byDay.get(k) ?? [];
    heat.push({ day: k, minutes: list.reduce((s, w) => s + w.durationMin, 0), count: list.length });
  }

  // --- Répartition 30 j par catégorie ---
  const last30 = inRange(addDays(t, -29));
  const split = (Object.keys(CATEGORIES) as Category[]).map((c) => ({
    category: c,
    minutes: last30.filter((w) => typeInfo(w.type).category === c).reduce((s, w) => s + w.durationMin, 0),
  }));

  // --- Totaux & badges ---
  const totalMin = all.reduce((s, w) => s + w.durationMin, 0);
  const totalKm = all.reduce((s, w) => s + (w.distanceKm ?? 0), 0);
  const maxWeekCats = Math.max(0, ...weeks.map((w) => Object.values(w.byCat).filter((m) => m > 0).length));
  const earlyBirds = all.filter((w) => hourInTZ(w.date) < 8).length;
  const badges = [
    { id: "first", emoji: "🎯", label: "Première séance", got: all.length >= 1 },
    { id: "10", emoji: "🔟", label: "10 séances", got: all.length >= 10 },
    { id: "50", emoji: "🏅", label: "50 séances", got: all.length >= 50 },
    { id: "100", emoji: "💯", label: "100 séances", got: all.length >= 100 },
    { id: "streak4", emoji: "🔥", label: "4 semaines d'affilée", got: weekStreak >= 4 },
    { id: "streak12", emoji: "🌋", label: "12 semaines d'affilée", got: weekStreak >= 12 },
    { id: "1000min", emoji: "⏱️", label: "1 000 minutes", got: totalMin >= 1000 },
    { id: "100km", emoji: "🛣️", label: "100 km parcourus", got: totalKm >= 100 },
    { id: "allround", emoji: "🎨", label: "3 catégories en 1 semaine", got: maxWeekCats >= 3 },
    { id: "early", emoji: "🌅", label: "5 séances avant 8 h", got: earlyBirds >= 5 },
  ];

  const lastWorkout = all[0];
  const daysSinceLast = lastWorkout ? diffDays(t, dayKey(lastWorkout.date)) : null;

  return {
    score,
    scoreParts,
    weeks,
    current,
    weeklyTarget,
    weekStreak,
    dayStreak,
    acute,
    chronic,
    acwr,
    who7,
    xp,
    level,
    levelProgress,
    heat,
    split,
    totalSessions: all.length,
    totalMin,
    totalKm,
    badges,
    daysSinceLast,
    last7,
  };
}
