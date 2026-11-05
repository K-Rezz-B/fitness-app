// Coach planificateur : génère la semaine d'entraînement (fonctions pures, testables).
// Règles : OMS 2020 (≥ 2 renforcements/sem, 150-300 min), 48 h entre deux séances des mêmes muscles,
// pas d'intensité la veille des jambes, cycle de 4 semaines (3 de progression + 1 de décharge),
// semaine allégée si la charge grimpe trop (ACWR > 1,3, Gabbett 2016) ou si la semaine passée a été ratée.
import { TEMPLATES, templateById, type Template } from "./templates";
import { typeInfo } from "./constants";
import type { Exercise, Workout } from "./schema";
import { addDays, dayKey } from "./dates";

export type Equipment = "gym" | "home" | "bodyweight";
export type Level = "beginner" | "intermediate" | "advanced";
export type Goal = "lose" | "maintain" | "gain" | "performance";
export type Kind = "force" | "easy" | "hard" | "long" | "mobility";
type Zone = "full" | "upper" | "lower" | null;

export const EQUIPMENT: Record<Equipment, string> = { gym: "Salle de sport", home: "Maison avec haltères", bodyweight: "Sans matériel" };
export const LEVELS: Record<Level, string> = { beginner: "Débutant (< 6 mois)", intermediate: "Intermédiaire (6 mois - 2 ans)", advanced: "Confirmé (> 2 ans)" };
/** Sports « cardio » proposés dans le questionnaire */
export const PLANNER_SPORTS = ["course", "velo", "natation", "marche", "boxe", "hiit", "yoga"] as const;
export const PHASES = [
  { label: "Mise en route", hint: "charges de référence, RPE 7" },
  { label: "Progression", hint: "charges en hausse, RPE 7-8" },
  { label: "Pic", hint: "charges au plus haut, RPE 8" },
  { label: "Décharge", hint: "volume réduit, RPE 5-6 : on récupère pour mieux repartir" },
];

const ZONE: Record<string, Zone> = {
  "fullbody-a": "full", "fullbody-b": "full", "db-fullbody-a": "full", "db-fullbody-b": "full", "bw-fullbody": "full", "bw-circuit": "full", wod: "full",
  upper: "upper", "upper-b": "upper", push: "upper", pull: "upper", "db-upper": "upper", "bw-upper": "upper",
  legs: "lower", "lower-b": "lower", "db-lower": "lower", "bw-lower": "lower",
};

const FORCE: Record<Equipment, { fb: [string, string]; upper: [string, string]; lower: [string, string]; ppl?: [string, string, string] }> = {
  gym: { fb: ["fullbody-a", "fullbody-b"], upper: ["upper", "upper-b"], lower: ["legs", "lower-b"], ppl: ["push", "pull", "legs"] },
  home: { fb: ["db-fullbody-a", "db-fullbody-b"], upper: ["db-upper", "db-upper"], lower: ["db-lower", "db-lower"] },
  bodyweight: { fb: ["bw-fullbody", "bw-circuit"], upper: ["bw-upper", "bw-upper"], lower: ["bw-lower", "bw-lower"] },
};

const CARDIO: Record<string, { easy?: string; hard?: string; long?: string }> = {
  course: { easy: "ef", hard: "fractionne", long: "sortie-longue" },
  velo: { easy: "velo-z2", hard: "velo-sst" },
  natation: { easy: "nage" },
  marche: { easy: "rando" },
  boxe: { hard: "boxe" },
  hiit: { hard: "tabata" },
};

export type PlannerPrefs = { days: number[]; time: string; sessionMin: number; equipment: Equipment; level: Level; sports: string[] };

export type PlannedSession = {
  weekday: number;
  time: string;
  durationMin: number;
  templateId: string;
  type: string;
  title: string;
  kind: Kind;
  rpe: number;
  why: string;
};

export type WeekPlan = { phase: number; easyWeek: boolean; sessions: PlannedSession[]; notes: string[] };

export type PlanInput = {
  goal: Goal;
  weeklyTarget: number;
  prefs: PlannerPrefs;
  weekIndex: number; // semaines depuis le début du cycle
  acwr: number | null;
  adherence: { done: number; planned: number } | null; // semaine précédente
};

const GOAL_LABEL: Record<Goal, string> = { lose: "perdre du gras", maintain: "santé / maintien", gain: "prendre du muscle", performance: "performance" };

/** Nombre de séances de force selon l'objectif (le reste en cardio / mobilité). */
function forceCount(goal: Goal, n: number) {
  if (n <= 1) return n;
  if (goal === "gain") return Math.min(n, 4);
  if (goal === "lose") return n >= 5 ? 3 : 2;
  return 2;
}

function forceSplit(f: number, level: Level, eq: Equipment, weekIndex: number): string[] {
  const s = FORCE[eq];
  const alt = weekIndex % 2;
  if (f === 1) return [s.fb[alt]];
  if (f === 2) return [s.fb[0], s.fb[1]];
  if (f === 3) {
    if (level === "beginner") return alt ? [s.fb[1], s.fb[0], s.fb[1]] : [s.fb[0], s.fb[1], s.fb[0]];
    return s.ppl ? [...s.ppl] : [s.upper[0], s.lower[0], s.fb[0]];
  }
  const ulul = [s.upper[0], s.lower[0], s.upper[1], s.lower[1]];
  return f === 4 ? ulul : [...ulul, s.fb[alt]];
}

type Slot = { kind: Kind; templateId: string };

export function composeWeek(input: PlanInput): { slots: Slot[]; phase: number; easyWeek: boolean; notes: string[] } {
  const { goal, prefs } = input;
  const notes: string[] = [];
  const n = Math.max(1, Math.min(input.weeklyTarget, prefs.days.length));
  if (input.weeklyTarget > prefs.days.length)
    notes.push(`${prefs.days.length} jour(s) dispo pour un objectif de ${input.weeklyTarget} séances : j'en prévois ${n}.`);

  const phase = ((input.weekIndex % 4) + 4) % 4;
  const overload = input.acwr !== null && input.acwr > 1.3;
  const missed = input.adherence && input.adherence.planned > 0 && input.adherence.done / input.adherence.planned < 0.5;
  const easyWeek = phase === 3 || overload || !!missed;
  if (overload) notes.push(`Charge récente élevée (ratio aigu/chronique ${input.acwr!.toFixed(2).replace(".", ",")} > 1,3) : semaine allégée pour limiter le risque de blessure.`);
  if (missed) notes.push(`${input.adherence!.done}/${input.adherence!.planned} séances faites la semaine dernière : reprise en douceur, même rythme.`);

  const f = forceCount(goal, n);
  const rest = n - f;
  const mobility = rest > 0 && ((goal === "maintain" && n >= 4) || n >= 6) ? 1 : 0;
  const cardio = rest - mobility;
  const canGoHard = !easyWeek && prefs.level !== "beginner";
  let hard = 0;
  if (canGoHard) hard = goal === "performance" ? Math.min(cardio, 1) : cardio >= 2 ? 1 : 0;
  const liked = prefs.sports.filter((s) => CARDIO[s]);
  const long = goal === "performance" && !easyWeek && cardio - hard >= 2 && liked.includes("course") ? 1 : 0;
  const easy = cardio - hard - long;

  const easyPool = liked.filter((s) => CARDIO[s].easy).map((s) => CARDIO[s].easy!);
  if (!easyPool.length) easyPool.push(prefs.level === "beginner" ? "rando" : "ef");
  const hardPool = liked.filter((s) => CARDIO[s].hard).map((s) => CARDIO[s].hard!);
  if (!hardPool.length) hardPool.push("tabata");

  const slots: Slot[] = [
    ...forceSplit(f, prefs.level, prefs.equipment, input.weekIndex).map((id) => ({ kind: "force" as const, templateId: id })),
    ...Array.from({ length: hard }, (_, i) => ({ kind: "hard" as const, templateId: hardPool[(i + input.weekIndex) % hardPool.length] })),
    ...Array.from({ length: long }, () => ({ kind: "long" as const, templateId: "sortie-longue" })),
    ...Array.from({ length: easy }, (_, i) => ({ kind: "easy" as const, templateId: easyPool[(i + input.weekIndex) % easyPool.length] })),
    ...Array.from({ length: mobility }, () => ({ kind: "mobility" as const, templateId: prefs.sports.includes("yoga") ? "yoga-flow" : "mobility" })),
  ];

  notes.unshift(
    `Objectif « ${GOAL_LABEL[goal]} » : ${f} séance(s) de renforcement${cardio ? ` + ${cardio} de cardio${hard ? ` (dont ${hard} intense)` : ""}` : ""}${mobility ? " + 1 de mobilité" : ""}. L'OMS recommande au moins 2 renforcements par semaine.`,
  );
  return { slots, phase, easyWeek, notes };
}

// ---------- placement dans la semaine ----------
const combos = (arr: number[], k: number): number[][] =>
  k === 0 ? [[]] : arr.flatMap((x, i) => combos(arr.slice(i + 1), k - 1).map((c) => [x, ...c]));

function* permutations<T>(arr: T[], key: (x: T) => string): Generator<T[]> {
  if (arr.length <= 1) {
    yield arr;
    return;
  }
  for (let i = 0; i < arr.length; i++) {
    if (arr.findIndex((x) => key(x) === key(arr[i])) !== i) continue; // évite les ordres identiques
    for (const p of permutations([...arr.slice(0, i), ...arr.slice(i + 1)], key)) yield [arr[i], ...p];
  }
}

const gaps = (days: number[]) => days.map((d, i) => (i ? d - days[i - 1] : d + 7 - days[days.length - 1]));

/** Jours choisis parmi les disponibilités : écart minimal le plus grand possible. */
function pickDays(available: number[], n: number): number[] {
  const sorted = cleanDays(available);
  let best = sorted.slice(0, n);
  let bestScore = -Infinity;
  for (const c of combos(sorted, n)) {
    const g = gaps(c);
    const score = Math.min(...g) * 10 - g.filter((x) => x === 1).length;
    if (score > bestScore) [best, bestScore] = [c, score];
  }
  return best;
}

const zoneOf = (s: Slot): Zone => (s.kind === "force" ? (ZONE[s.templateId] ?? "full") : null);
const overlap = (a: Zone, b: Zone) => !!a && !!b && (a === "full" || b === "full" || a === b);
function scoreAssignment(days: number[], order: Slot[]): number {
  let score = 0;
  for (let i = 0; order.length > 1 && i < order.length; i++) {
    const a = order[i];
    const j = (i + 1) % order.length;
    const b = order[j];
    const gap = j === 0 ? days[0] + 7 - days[i] : days[j] - days[i];
    if (gap === 1) {
      if (overlap(zoneOf(a), zoneOf(b))) score += j === 0 ? 50 : 100; // < 48 h sur les mêmes muscles
      if (a.kind === "hard" && (zoneOf(b) === "lower" || zoneOf(b) === "full")) score += 40; // intensité la veille des jambes
      if (a.kind === "hard" && b.kind === "hard") score += 30;
      if (a.templateId === b.templateId) score += 10;
      if (a.kind === "hard" && b.kind === "mobility") score -= 5;
    }
  }
  order.forEach((s, i) => {
    if (s.kind === "long" && days[i] >= 6) score -= 15; // sortie longue le week-end
  });
  return score;
}

const WHY: Record<Kind, string> = {
  force: "Renforcement : muscles, os et métabolisme",
  easy: "Zone 2 (tu peux parler) : base aérobie, récupération entre les séances de force",
  hard: "Intensité courte : gros effet sur le VO₂max en peu de temps",
  long: "Sortie longue le week-end : endurance",
  mobility: "Mobilité : amplitude et récupération active",
};

// ---------- programmes compatibles avec le profil (matériel, sports, niveau) ----------
type Needs = "gym" | "dumbbells" | "none" | "bike" | "pool" | "bag";
const NEEDS: Record<string, Needs> = {
  "fullbody-a": "gym", "fullbody-b": "gym", push: "gym", pull: "gym", legs: "gym", upper: "gym", "upper-b": "gym", "lower-b": "gym",
  emom: "gym", wod: "gym", // kettlebell, barre de traction
  "db-fullbody-a": "dumbbells", "db-fullbody-b": "dumbbells", "db-upper": "dumbbells", "db-lower": "dumbbells",
  "velo-z2": "bike", "velo-sst": "bike", nage: "pool", boxe: "bag",
};
const HARD = new Set(["fractionne", "tabata", "emom", "wod", "velo-sst"]);

/** Programmes faisables avec ce matériel (la salle permet tout, les haltères permettent aussi le poids du corps). */
export function templatesFor(o: { equipment: Equipment; sports: string[]; level: Level }): Template[] {
  return TEMPLATES.filter((t) => {
    const n = NEEDS[t.id] ?? "none";
    if (o.level === "beginner" && HARD.has(t.id)) return false;
    if (n === "gym") return o.equipment === "gym";
    if (n === "dumbbells") return o.equipment !== "bodyweight";
    if (n === "bike") return o.sports.includes("velo") || o.equipment === "gym";
    if (n === "pool") return o.sports.includes("natation");
    if (n === "bag") return o.sports.includes("boxe");
    return true;
  });
}

export const cleanDays = (days: number[]) => [...new Set(days)].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort((a, b) => a - b);

export function planWeek(raw: PlanInput): WeekPlan {
  const input = { ...raw, prefs: { ...raw.prefs, days: cleanDays(raw.prefs.days) } };
  if (!input.prefs.days.length) return { phase: 0, easyWeek: false, sessions: [], notes: ["Choisis au moins un jour disponible."] };
  const { slots, phase, easyWeek, notes } = composeWeek(input);
  const days = pickDays(input.prefs.days, slots.length);
  let best = slots;
  let bestScore = Infinity;
  for (const p of permutations(slots, (s) => s.kind + s.templateId)) {
    const s = scoreAssignment(days, p);
    if (s < bestScore) [best, bestScore] = [p, s];
  }
  if (slots.length > 1 && bestScore < 50) notes.push("Au moins 48 h entre deux séances qui sollicitent les mêmes muscles.");
  else if (bestScore >= 50) notes.push("Jours disponibles rapprochés : j'ai alterné haut / bas du corps au mieux.");
  notes.push(
    easyWeek && phase !== 3
      ? `Semaine ${phase + 1}/4 du cycle : progression en pause cette semaine (volume réduit, RPE 5-6), elle reprend ensuite.`
      : `Semaine ${phase + 1}/4 du cycle · ${PHASES[phase].label} : ${PHASES[phase].hint}.`,
  );

  const sessionMin = input.prefs.sessionMin;
  const sessions = best.map((slot, i): PlannedSession => {
    const t = templateById(slot.templateId)!;
    const durationMin =
      slot.kind === "hard" ? Math.min(sessionMin, t.durationMin) : slot.kind === "mobility" ? Math.min(30, sessionMin) : slot.kind === "long" ? Math.max(sessionMin, 60) : sessionMin;
    let rpe = t.rpe;
    if (slot.kind === "force") rpe = easyWeek ? 5 : phase === 2 ? 8 : 7;
    if (input.prefs.level === "beginner" && slot.kind === "force") rpe = Math.min(rpe, 7);
    return { weekday: days[i], time: input.prefs.time, durationMin, templateId: t.id, type: t.type, title: t.title, kind: slot.kind, rpe, why: WHY[slot.kind] };
  });
  return { phase, easyWeek, sessions, notes };
}

// ---------- prescription des exercices (séries, reps, charge conseillée) ----------
export const baseName = (name: string) =>
  name
    .replace(/\s*\(.*\)\s*$/, "")
    .trim()
    .toLowerCase();

/** Meilleure charge récente (42 j) par exercice, d'après les séances enregistrées. */
export function recentMaxLoads(workouts: Pick<Workout, "date" | "exercises">[], todayKey: string): Map<string, number> {
  const from = addDays(todayKey, -42);
  const max = new Map<string, number>();
  for (const w of workouts) {
    if (dayKey(w.date) < from) continue;
    for (const e of w.exercises ?? []) {
      const best = Math.max(0, ...e.sets.map((s) => s.weight ?? 0));
      if (best > 0) max.set(baseName(e.name), Math.max(best, max.get(baseName(e.name)) ?? 0));
    }
  }
  return max;
}

/** Durée / distance / « max » plutôt qu'un nombre de répétitions ("45 s", "30 s/côté", "400 m", "max") */
export const isTimed = (reps: string) => /\d+\s*s\b|min|max|\d+\s*m\b/.test(reps);

const INCREMENT: Record<Level, number> = { beginner: 0.025, intermediate: 0.02, advanced: 0.01 };
const roundLoad = (kg: number) => (kg >= 20 ? Math.round(kg / 2.5) * 2.5 : Math.round(kg));

export type Prescription = { name: string; sets: number; reps: string; weightKg: number | null; hint?: string };

export function prescribe(t: Template, o: { phase: number; easyWeek: boolean; level: Level; durationMin: number; loads: Map<string, number> }): Prescription[] {
  const force = typeInfo(t.type).category === "force";
  const scale = force && o.durationMin < t.durationMin ? o.durationMin / t.durationMin : 1;
  const factor = o.easyWeek ? 0.85 : o.phase === 0 ? 1 : 1 + INCREMENT[o.level];
  return t.exercises.map((e) => {
    let sets = e.sets;
    let reps = e.reps;
    if (force) {
      if (o.level === "beginner") sets -= 1;
      if (o.easyWeek) sets -= 1;
      sets = Math.max(2, Math.round(sets * scale));
    } else if (t.exercises.length === 1 && /^\d+ min$/.test(reps)) {
      reps = `${o.durationMin} min`; // footing, vélo, marche : durée de la séance
    }
    const last = force ? o.loads.get(baseName(e.name)) : undefined;
    const timed = isTimed(e.reps);
    return {
      name: e.name,
      sets,
      reps,
      weightKg: last && !timed ? roundLoad(last * factor) : null,
      hint: force && !timed && !last ? "charge qui laisse 2 reps en réserve" : undefined,
    };
  });
}

/** Exercices pré-remplis du formulaire de séance (même format que templateToExercises). */
export function prescriptionToExercises(p: Prescription[]): Exercise[] {
  return p.map((e) => ({
    name: `${e.name} (${e.sets}×${e.reps})`,
    sets: Array.from({ length: Math.min(e.sets, 10) }, () => {
      const n = parseInt(e.reps, 10);
      return {
        reps: Number.isFinite(n) && !isTimed(e.reps) ? n : undefined,
        weight: e.weightKg ?? undefined,
      };
    }),
  }));
}

