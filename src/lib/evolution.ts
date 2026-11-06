// Page « Mon évolution » : agrège TOUTES les données collectées (séances, exercices, pesées,
// activité Apple Santé) sur une période. Fonctions pures : les graphiques (composants client)
// ne reçoivent que des nombres déjà calculés, jamais le profil complet.
import type { DailyActivity, Exercise, Weight, Workout } from "./schema";
import { typeInfo, WORKOUT_TYPES, type Category } from "./constants";
import { addDays, dayKey, diffDays, fmtDate, hourInTZ, isoWeekday, keyToUTC, weekStart } from "./dates";
import { formScore, load } from "./stats";
import { movingAverage } from "./coach";
import { estimateCalories } from "./ingest";
import { e1rm, exerciseKey } from "./records";

export const PERIODS = {
  "1m": { label: "1 mois", days: 30 },
  "3m": { label: "3 mois", days: 91 },
  "6m": { label: "6 mois", days: 182 },
  "1a": { label: "1 an", days: 365 },
  tout: { label: "Tout", days: null },
} as const satisfies Record<string, { label: string; days: number | null }>;
export type PeriodKey = keyof typeof PERIODS;
export const DEFAULT_PERIOD: PeriodKey = "3m";
export const parsePeriod = (v: unknown): PeriodKey =>
  typeof v === "string" && Object.hasOwn(PERIODS, v) ? (v as PeriodKey) : DEFAULT_PERIOD;

/** Pas de temps des graphiques : jour, semaine (lundi) ou mois */
export type Grain = "day" | "week" | "month";
export type Range = {
  period: PeriodKey;
  from: string;
  to: string;
  /** Séances : semaine jusqu'à ~6 mois, mois au-delà */
  grain: Grain;
  /** Activité quotidienne : jour sur 1 mois, sinon comme les séances */
  activityGrain: Grain;
  /** Période précédente de même durée (comparaisons), null pour « Tout » */
  prev: { from: string; to: string } | null;
};

const monthStart = (k: string) => `${k.slice(0, 7)}-01`;
const nextMonth = (k: string) => {
  const d = keyToUTC(monthStart(k));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return d.toISOString().slice(0, 10);
};
const grainStart = (k: string, g: Grain) => (g === "day" ? k : g === "week" ? weekStart(k) : monthStart(k));
const nextStart = (k: string, g: Grain) => (g === "day" ? addDays(k, 1) : g === "week" ? addDays(k, 7) : nextMonth(k));

/** Bornes de la période, alignées sur le début de semaine / mois pour des barres complètes. */
export function resolveRange(period: PeriodKey, t: string, earliest: string | null): Range {
  const days = PERIODS[period].days;
  const rawFrom = days ? addDays(t, -(days - 1)) : earliest && earliest < t ? earliest : addDays(t, -29);
  const span = diffDays(t, rawFrom) + 1;
  const grain: Grain = span <= 200 ? "week" : "month";
  const from = grainStart(rawFrom, grain);
  const len = diffDays(t, from) + 1;
  return {
    period,
    from,
    to: t,
    grain,
    activityGrain: span <= 31 ? "day" : grain,
    prev: days ? { from: addDays(from, -len), to: addDays(from, -1) } : null,
  };
}

type Bucket = { start: string; label: string; title: string; elapsed: number };

function makeBuckets(from: string, to: string, grain: Grain, perDay: boolean): Bucket[] {
  const out: Bucket[] = [];
  for (let s = grainStart(from, grain); s <= to; s = nextStart(s, grain)) {
    const end = addDays(nextStart(s, grain), -1);
    const a = s < from ? from : s;
    const b = end < to ? end : to;
    const month = fmtDate(s, { day: undefined, month: "short", year: "2-digit" });
    out.push({
      start: s,
      label: grain === "month" ? month : fmtDate(s),
      title:
        grain === "day"
          ? fmtDate(s, { weekday: "long" })
          : grain === "week"
            ? `Semaine du ${fmtDate(s)}${perDay ? " · moyenne / jour" : ""}`
            : `${month} · moyenne / ${perDay ? "jour" : "sem."}`,
      elapsed: diffDays(b, a) + 1,
    });
  }
  return out;
}

const r1 = (x: number) => Math.round(x * 10) / 10;
const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const avgOf = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

/** Volume soulevé (tonnage) : Σ reps × charge */
export const tonnage = (ex: Exercise[]) =>
  ex.reduce((s, e) => s + e.sets.reduce((t, x) => t + (x.reps ?? 0) * (x.weight ?? 0), 0), 0);

type Totals = {
  sessions: number;
  minutes: number;
  byCat: Record<Category, number>;
  load: number;
  rpeSum: number;
  distanceKm: number;
  kcal: number;
  tonnage: number;
};
const blank = (): Totals => ({
  sessions: 0,
  minutes: 0,
  byCat: { force: 0, cardio: 0, mobilite: 0 },
  load: 0,
  rpeSum: 0,
  distanceKm: 0,
  kcal: 0,
  tonnage: 0,
});

export type TrainingPoint = {
  label: string;
  title: string;
  /** Toutes les valeurs sont « par semaine » (moyenne hebdo pour les vues par mois) */
  sessions: number;
  minutes: number;
  force: number;
  cardio: number;
  mobilite: number;
  load: number;
  rpe: number | null;
  distanceKm: number;
  kcal: number;
  tonnage: number;
};
export type ScorePoint = { label: string; title: string; score: number; acwr: number | null; acute: number };
export type ActivityPoint = {
  label: string;
  title: string;
  /** Moyennes par jour, sur les jours qui ont des données */
  steps: number | null;
  activeKcal: number | null;
  exerciseMin: number | null;
  standHours: number | null;
  distanceKm: number | null;
};
export type TypeShare = { type: string; label: string; emoji: string; category: Category; minutes: number; sessions: number };
export type ExerciseSeries = {
  key: string;
  name: string;
  /** e1rm = 1RM estimé (kg) ; reps = meilleure série au poids du corps */
  metric: "e1rm" | "reps";
  points: { label: string; title: string; value: number; set: string; tonnage: number }[];
  best: { value: number; set: string; date: string };
};
export type RecordItem = { emoji: string; label: string; value: string; detail: string };

export const TIME_BANDS = [
  { label: "Avant 8 h", until: 8 },
  { label: "8 h – 12 h", until: 12 },
  { label: "12 h – 14 h", until: 14 },
  { label: "14 h – 18 h", until: 18 },
  { label: "18 h – 21 h", until: 21 },
  { label: "Après 21 h", until: 24 },
];
const bandOf = (hour: number) => TIME_BANDS.findIndex((b) => hour < b.until);

export type EvolutionProfile = {
  weeklySessionsTarget: number;
  stepsGoal: number;
  moveGoalKcal: number;
  goal: string;
};

export function buildEvolution(input: {
  workouts: Workout[];
  weights: Weight[];
  activity: DailyActivity[];
  profile: EvolutionProfile;
  period: PeriodKey;
  today: string;
}) {
  const { profile, today: t } = input;
  const target = profile.weeklySessionsTarget;
  const keyed = input.workouts.map((w) => ({ w, day: dayKey(w.date) })).sort((a, b) => a.w.date.getTime() - b.w.date.getTime());
  const weightsAsc = [...input.weights].sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  const activity = [...input.activity].sort((a, b) => a.date.localeCompare(b.date));

  const earliest = [keyed[0]?.day, weightsAsc[0]?.date, activity[0]?.date].filter(Boolean).sort()[0] ?? null;
  const resolved = resolveRange(input.period, t, earliest);
  // Pas de comparaison si la période précédente commence avant les premières données (+700 % trompeurs)
  const range: Range = { ...resolved, prev: resolved.prev && earliest !== null && earliest <= resolved.prev.from ? resolved.prev : null };
  const { from, to, grain } = range;
  const inRange = (k: string, r: { from: string; to: string } = range) => k >= r.from && k <= r.to;
  const multiYear = diffDays(to, from) > 330;
  const dayLabel = (k: string) => fmtDate(k, multiYear ? { year: "2-digit" } : {});

  // --- Calories : mesurées (montre / saisie) sinon estimées MET × poids du moment ---
  const kgAt = (day: string) => {
    let kg = weightsAsc[0]?.weightKg ?? null;
    for (const w of weightsAsc) {
      if (w.date > day) break;
      kg = w.weightKg;
    }
    return kg;
  };
  const kcalOf = (w: Workout, day: string) => {
    if (w.calories !== null) return { kcal: w.calories, estimated: false };
    const kg = kgAt(day);
    return { kcal: kg ? estimateCalories(typeInfo(w.type).met, kg, w.durationMin) : 0, estimated: kg !== null };
  };
  const addTo = (a: Totals, w: Workout, kcal: number) => {
    a.sessions++;
    a.minutes += w.durationMin;
    a.byCat[typeInfo(w.type).category] += w.durationMin;
    a.load += load(w);
    a.rpeSum += w.rpe;
    a.distanceKm += w.distanceKm ?? 0;
    a.kcal += kcal;
    a.tonnage += tonnage(w.exercises);
  };

  const current = keyed.filter(({ day }) => inRange(day));
  const totals = blank();
  const prevTotals = range.prev ? blank() : null;
  const kcalById = new Map<number, number>();
  let kcalEstimated = 0;
  for (const { w, day } of keyed) {
    const isCurrent = inRange(day);
    if (!isCurrent && !(prevTotals && range.prev && inRange(day, range.prev))) continue;
    const { kcal, estimated } = kcalOf(w, day);
    kcalById.set(w.id, kcal);
    if (isCurrent) {
      addTo(totals, w, kcal);
      if (estimated) kcalEstimated++;
    } else addTo(prevTotals!, w, kcal);
  }

  // --- Séances par semaine (ou moyenne hebdo par mois) ---
  const tBuckets = makeBuckets(from, to, grain, false);
  const tIndex = new Map(tBuckets.map((b, i) => [b.start, i]));
  const tAcc = tBuckets.map(blank);
  for (const { w, day } of current) {
    const i = tIndex.get(grainStart(day, grain));
    if (i !== undefined) addTo(tAcc[i], w, kcalById.get(w.id) ?? 0);
  }
  const training: TrainingPoint[] = tBuckets.map((b, i) => {
    const a = tAcc[i];
    const k = grain === "week" ? 1 : 7 / b.elapsed;
    return {
      label: b.label,
      title: b.title,
      sessions: r1(a.sessions * k),
      minutes: Math.round(a.minutes * k),
      force: Math.round(a.byCat.force * k),
      cardio: Math.round(a.byCat.cardio * k),
      mobilite: Math.round(a.byCat.mobilite * k),
      load: Math.round(a.load * k),
      rpe: a.sessions ? r1(a.rpeSum / a.sessions) : null,
      distanceKm: r1(a.distanceKm * k),
      kcal: Math.round(a.kcal * k),
      tonnage: Math.round(a.tonnage * k),
    };
  });

  // --- Score de forme & ratio de charge, reconstitués en fin de chaque semaine ---
  const byDay = new Map<string, Workout[]>();
  for (const { w, day } of keyed) byDay.set(day, [...(byDay.get(day) ?? []), w]);
  const score: ScorePoint[] = [];
  for (let ws = weekStart(from); ws <= to; ws = addDays(ws, 7)) {
    const day = addDays(ws, 6) < to ? addDays(ws, 6) : to;
    if (day < from) continue;
    const f = formScore(byDay, target, day);
    score.push({
      label: dayLabel(day),
      title: day === to ? "Aujourd'hui" : `Fin de semaine · ${fmtDate(day, { weekday: "short" })}`,
      score: f.score,
      acwr: f.acwr === null ? null : Math.round(f.acwr * 100) / 100,
      acute: f.acute,
    });
  }

  // --- Répartition par activité ---
  const typeMap = new Map<string, TypeShare>();
  for (const { w } of current) {
    const info = typeInfo(w.type);
    const s = typeMap.get(w.type) ?? { type: w.type, label: info.label, emoji: info.emoji, category: info.category, minutes: 0, sessions: 0 };
    s.minutes += w.durationMin;
    s.sessions++;
    typeMap.set(w.type, s);
  }
  const types = [...typeMap.values()].sort((a, b) => b.minutes - a.minutes || b.sessions - a.sessions);

  // --- Jour × créneau horaire ---
  const when = Array.from({ length: 7 }, () => TIME_BANDS.map(() => 0));
  for (const { w, day } of current) when[isoWeekday(day) - 1][bandOf(hourInTZ(w.date))]++;

  // --- Calendrier (12 derniers mois au plus) ---
  const calFrom = weekStart(from > addDays(to, -364) ? from : addDays(to, -364));
  const calendar: { day: string; minutes: number; count: number }[] = [];
  for (let k = calFrom; k <= addDays(weekStart(to), 6); k = addDays(k, 1)) {
    const list = byDay.get(k) ?? [];
    calendar.push({ day: k, minutes: list.reduce((s, w) => s + w.durationMin, 0), count: list.length });
  }

  // --- Exercices : progression séance après séance ---
  const exMap = new Map<string, { name: string; sessions: { day: string; ex: Exercise }[] }>();
  for (const { w, day } of current) {
    for (const ex of w.exercises) {
      if (!ex.name?.trim() || !ex.sets.some((s) => (s.reps ?? 0) > 0 || (s.weight ?? 0) > 0)) continue;
      const key = exerciseKey(ex.name);
      const e = exMap.get(key) ?? { name: ex.name.trim(), sessions: [] };
      e.name = ex.name.trim(); // garde l'orthographe la plus récente
      e.sessions.push({ day, ex });
      exMap.set(key, e);
    }
  }
  const exercises: ExerciseSeries[] = [];
  for (const [key, e] of exMap) {
    const weighted = e.sessions.some(({ ex }) => ex.sets.some((s) => (s.weight ?? 0) > 0));
    const points: ExerciseSeries["points"] = [];
    let best: ExerciseSeries["best"] | null = null;
    for (const { day, ex } of e.sessions) {
      let value = 0;
      let set = "";
      for (const s of ex.sets) {
        const reps = s.reps ?? 0;
        const kg = s.weight ?? 0;
        if (weighted) {
          if (kg <= 0) continue;
          const v = e1rm(kg, Math.max(1, reps));
          if (v > value) [value, set] = [v, `${nf.format(kg)} kg × ${Math.max(1, reps)}`];
        } else if (reps > value) [value, set] = [reps, `${reps} reps`];
      }
      if (value <= 0) continue;
      value = r1(value);
      const tn = tonnage([ex]);
      points.push({
        label: dayLabel(day),
        title: fmtDate(day, { weekday: "short", ...(multiYear ? { year: "2-digit" } : {}) }),
        value,
        set,
        tonnage: Math.round(tn),
      });
      if (!best || value > best.value) best = { value, set, date: day };
    }
    if (best) exercises.push({ key, name: e.name, metric: weighted ? "e1rm" : "reps", points, best });
  }
  exercises.sort((a, b) => b.points.length - a.points.length || a.name.localeCompare(b.name, "fr"));

  // --- Poids & composition ---
  const weightSeries = movingAverage(weightsAsc)
    .filter((d) => inRange(d.date))
    .map((d) => ({ label: dayLabel(d.date), weight: d.weight, avg: Math.round(d.avg * 100) / 100 }));
  const bodyFat = weightsAsc
    .filter((w) => inRange(w.date) && w.bodyFatPct !== null)
    .map((w) => ({
      label: dayLabel(w.date),
      title: fmtDate(w.date, { weekday: "short" }),
      value: w.bodyFatPct!,
      note: `${nf.format(w.weightKg)} kg · masse maigre ≈ ${nf.format(r1(w.weightKg * (1 - w.bodyFatPct! / 100)))} kg`,
    }));

  // --- Activité quotidienne (moyenne par jour) ---
  const ag = range.activityGrain;
  const aBuckets = makeBuckets(from, to, ag, true);
  const aIndex = new Map(aBuckets.map((b, i) => [b.start, i]));
  const aDays = aBuckets.map(() => [] as DailyActivity[]);
  const curActivity = activity.filter((a) => inRange(a.date));
  for (const a of curActivity) {
    const i = aIndex.get(grainStart(a.date, ag));
    if (i !== undefined) aDays[i].push(a);
  }
  const round = (x: number | null, d = 0) => (x === null ? null : Math.round(x * 10 ** d) / 10 ** d);
  const activitySeries: ActivityPoint[] = aBuckets.map((b, i) => {
    const list = aDays[i];
    return {
      label: b.label,
      title: b.title,
      steps: round(avgOf(list.map((a) => a.steps))),
      activeKcal: round(avgOf(list.map((a) => a.activeKcal))),
      exerciseMin: round(avgOf(list.map((a) => a.exerciseMin))),
      standHours: round(avgOf(list.map((a) => a.standHours)), 1),
      distanceKm: round(avgOf(list.map((a) => a.distanceKm)), 1),
    };
  });
  const has = (f: (a: DailyActivity) => number | null) => curActivity.some((a) => f(a) !== null);
  const stepDays = curActivity.filter((a) => a.steps !== null);
  const moveDays = curActivity.filter((a) => a.activeKcal !== null);
  const activitySummary = {
    days: curActivity.length,
    has: {
      steps: has((a) => a.steps),
      activeKcal: has((a) => a.activeKcal),
      exerciseMin: has((a) => a.exerciseMin),
      standHours: has((a) => a.standHours),
      distanceKm: has((a) => a.distanceKm),
    },
    stepsAvg: round(avgOf(stepDays.map((a) => a.steps))),
    prevStepsAvg: range.prev
      ? round(avgOf(activity.filter((a) => inRange(a.date, range.prev!)).map((a) => a.steps)))
      : null,
    stepsGoalDays: stepDays.filter((a) => a.steps! >= profile.stepsGoal).length,
    stepDays: stepDays.length,
    moveGoalDays: moveDays.filter((a) => a.activeKcal! >= profile.moveGoalKcal).length,
    moveDays: moveDays.length,
  };

  // --- Meilleures perfs de la période ---
  const records: RecordItem[] = [];
  const maxBy = <T>(xs: T[], f: (x: T) => number) => xs.reduce<T | undefined>((m, x) => (m === undefined || f(x) > f(m) ? x : m), undefined);
  const longest = maxBy(current, ({ w }) => w.durationMin);
  if (longest)
    records.push({ emoji: "⏱️", label: "Plus longue séance", value: `${longest.w.durationMin} min`, detail: `${longest.w.title} · ${fmtDate(longest.day)}` });
  const hardest = maxBy(current, ({ w }) => load(w));
  if (hardest)
    records.push({ emoji: "🥵", label: "Séance la plus exigeante", value: `${load(hardest.w)} UA`, detail: `${hardest.w.title} · ${hardest.w.durationMin} min à RPE ${hardest.w.rpe} · ${fmtDate(hardest.day)}` });
  const weeks = new Map<string, { minutes: number; sessions: number }>();
  for (const { w, day } of current) {
    const k = weekStart(day);
    const x = weeks.get(k) ?? { minutes: 0, sessions: 0 };
    x.minutes += w.durationMin;
    x.sessions++;
    weeks.set(k, x);
  }
  const bestWeek = maxBy([...weeks], ([, x]) => x.minutes);
  if (bestWeek)
    records.push({ emoji: "📆", label: "Meilleure semaine", value: `${bestWeek[1].minutes} min`, detail: `${bestWeek[1].sessions} séance(s) · semaine du ${fmtDate(bestWeek[0])}` });
  for (const type of WORKOUT_TYPES.filter((x) => x.hasDistance)) {
    const best = maxBy(current.filter(({ w }) => w.type === type.id && (w.distanceKm ?? 0) > 0), ({ w }) => w.distanceKm!);
    if (best)
      records.push({ emoji: type.emoji, label: `Plus longue distance · ${type.label}`, value: `${nf.format(best.w.distanceKm!)} km`, detail: `${best.w.durationMin} min · ${fmtDate(best.day)}` });
  }
  const topSteps = maxBy(stepDays, (a) => a.steps!);
  if (topSteps)
    records.push({ emoji: "👟", label: "Record de pas", value: `${nf.format(topSteps.steps!)} pas`, detail: fmtDate(topSteps.date, { weekday: "long" }) });
  for (const ex of exercises.filter((x) => x.metric === "e1rm").sort((a, b) => b.best.value - a.best.value).slice(0, 3))
    records.push({ emoji: "🏋️", label: ex.name, value: ex.best.set, detail: `1RM estimé ${nf.format(ex.best.value)} kg · ${fmtDate(ex.best.date)}` });

  // --- Chiffres clés ---
  const latestWeight = weightsAsc.filter((w) => w.date <= to).at(-1) ?? null;
  const weightChange = weightSeries.length >= 2 ? r1(weightSeries.at(-1)!.avg - weightSeries[0].avg) : null;

  return {
    range,
    multiYear,
    totals,
    prevTotals,
    kcalEstimated,
    training,
    score,
    types,
    when,
    calendar,
    exercises,
    weights: weightSeries,
    latestWeight: latestWeight ? { kg: latestWeight.weightKg, date: latestWeight.date } : null,
    weightChange,
    bodyFat,
    activity: activitySeries,
    activitySummary,
    records,
  };
}

export type Evolution = ReturnType<typeof buildEvolution>;
