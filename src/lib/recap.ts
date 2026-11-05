import type { DailyActivity, Weight, Workout } from "./schema";
import { WEEKDAYS, typeInfo } from "./constants";
import { addDays, dayKey, isoWeekday, today, weekStart } from "./dates";
import { load } from "./stats";
import { exerciseIndex } from "./records";

export type Period = "week" | "month";

/** Bornes [from, to[ de la période décalée de `offset` (0 = en cours, 1 = précédente…). */
export function periodRange(period: Period, offset: number, t = today()) {
  if (period === "week") {
    const from = addDays(weekStart(t), -7 * offset);
    return { from, to: addDays(from, 7) };
  }
  const [y, m] = t.split("-").map(Number);
  const first = (k: number) => {
    const d = new Date(Date.UTC(y, m - 1 - k, 1));
    return d.toISOString().slice(0, 10);
  };
  return { from: first(offset), to: first(offset - 1) };
}

function totals(list: Workout[]) {
  return {
    sessions: list.length,
    minutes: list.reduce((s, w) => s + w.durationMin, 0),
    km: list.reduce((s, w) => s + (w.distanceKm ?? 0), 0),
    load: list.reduce((s, w) => s + load(w), 0),
    kcal: list.reduce((s, w) => s + (w.calories ?? 0), 0),
    activeDays: new Set(list.map((w) => dayKey(w.date))).size,
  };
}

/** Variation en % (null si rien à comparer). */
const delta = (cur: number, prev: number) => (prev > 0 ? Math.round(((cur - prev) / prev) * 100) : null);

export function buildRecap(all: Workout[], weights: Weight[], activity: DailyActivity[], period: Period, offset: number) {
  const { from, to } = periodRange(period, offset);
  const span = period === "week" ? 7 : Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
  const ongoing = to > today();
  // Période en cours : on la compare au même nombre de jours de la précédente (lundi → aujourd'hui)
  const prevFull = periodRange(period, offset + 1);
  const elapsed = Math.round((Date.parse(addDays(today(), 1)) - Date.parse(from)) / 86_400_000);
  const prevRange = ongoing ? { from: prevFull.from, to: [addDays(prevFull.from, elapsed), prevFull.to].sort()[0] } : prevFull;
  const inRange = (w: Workout, a: string, b: string) => {
    const k = dayKey(w.date);
    return k >= a && k < b;
  };
  const list = all.filter((w) => inRange(w, from, to));
  const prev = all.filter((w) => inRange(w, prevRange.from, prevRange.to));
  const cur = totals(list);
  const before = totals(prev);

  // Type de séance favori, jour préféré, plus longue séance
  const byType = new Map<string, number>();
  for (const w of list) byType.set(w.type, (byType.get(w.type) ?? 0) + 1);
  const favType = [...byType].sort((a, b) => b[1] - a[1])[0];
  const byWeekday = Array(7).fill(0);
  for (const w of list) byWeekday[isoWeekday(dayKey(w.date)) - 1] += w.durationMin;
  const bestDay = byWeekday.some((m) => m > 0) ? WEEKDAYS[byWeekday.indexOf(Math.max(...byWeekday))] : null;
  const longest = [...list].sort((a, b) => b.durationMin - a.durationMin)[0];

  // Records battus pendant la période (par rapport à tout ce qui précède)
  const records: { name: string; value: string; date: string }[] = [];
  for (const ex of exerciseIndex(all)) {
    let best = { w: 0, r: 0 };
    ex.points.forEach((p, i) => {
      const bw = p.maxWeight === 0;
      const beats = i > 0 && (bw ? p.maxReps > best.r : p.maxWeight > best.w);
      if (beats && p.date >= from && p.date < to) records.push({ name: ex.name, value: bw ? `${p.maxReps} reps` : `${p.maxWeight} kg`, date: p.date });
      best = { w: Math.max(best.w, p.maxWeight), r: Math.max(best.r, p.maxReps) };
    });
  }

  // Poids : première et dernière pesée de la période
  const wIn = weights.filter((w) => w.date >= from && w.date < to).sort((a, b) => a.date.localeCompare(b.date));
  const weightChange = wIn.length >= 2 ? wIn[wIn.length - 1].weightKg - wIn[0].weightKg : null;

  // Pas (app Forme)
  const steps = activity.filter((a) => a.date >= from && a.date < to && a.steps !== null);
  const stepsAvg = steps.length ? Math.round(steps.reduce((s, a) => s + (a.steps ?? 0), 0) / steps.length) : null;

  return {
    from,
    to,
    span,
    ongoing,
    cur,
    before,
    deltas: { sessions: delta(cur.sessions, before.sessions), minutes: delta(cur.minutes, before.minutes), load: delta(cur.load, before.load) },
    favType: favType ? { ...typeInfo(favType[0]), count: favType[1] } : null,
    bestDay,
    longest: longest ? { title: longest.title, minutes: longest.durationMin, emoji: typeInfo(longest.type).emoji } : null,
    records: records.sort((a, b) => a.date.localeCompare(b.date)),
    weightChange,
    stepsAvg,
  };
}

export type Recap = ReturnType<typeof buildRecap>;
