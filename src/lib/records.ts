import type { Exercise, ExerciseSet, Workout } from "./schema";
import { dayKey } from "./dates";

/** Nom d'exercice comparable : « Développé couché » = « developpe  couche ». */
export const exerciseKey = (name: string) =>
  name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();

/** 1RM estimé (Epley 1985) : charge × (1 + reps / 30). */
export const e1rm = (weight: number, reps: number) => (reps <= 1 ? weight : weight * (1 + reps / 30));

const round1 = (n: number) => Math.round(n * 10) / 10;

export type ExercisePoint = {
  date: string;
  workoutId: number;
  maxWeight: number;
  e1rm: number;
  maxReps: number;
  volume: number; // Σ reps × charge
  sets: ExerciseSet[];
};

export type ExerciseSummary = {
  key: string;
  name: string;
  points: ExercisePoint[]; // ordre chronologique
  best: { maxWeight: number; maxWeightDate: string; e1rm: number; e1rmDate: string; maxReps: number; maxRepsDate: string };
  last: ExercisePoint;
};

function pointOf(ex: Exercise, w: Pick<Workout, "id" | "date">): ExercisePoint | null {
  const sets = ex.sets.filter((s) => (s.reps ?? 0) > 0 || (s.weight ?? 0) > 0);
  if (!sets.length) return null;
  let maxWeight = 0, best = 0, maxReps = 0, volume = 0;
  for (const s of sets) {
    const reps = s.reps ?? 0, kg = s.weight ?? 0;
    maxWeight = Math.max(maxWeight, kg);
    maxReps = Math.max(maxReps, reps);
    if (kg > 0 && reps > 0) best = Math.max(best, e1rm(kg, reps));
    volume += reps * kg;
  }
  return { date: dayKey(w.date), workoutId: w.id, maxWeight, e1rm: round1(best), maxReps, volume: Math.round(volume), sets };
}

/** Historique et records par exercice, à partir de toutes les séances du profil. */
export function exerciseIndex(all: Pick<Workout, "id" | "date" | "exercises">[]): ExerciseSummary[] {
  const map = new Map<string, ExerciseSummary>();
  const chrono = [...all].sort((a, b) => a.date.getTime() - b.date.getTime());
  for (const w of chrono) {
    for (const ex of w.exercises ?? []) {
      const key = exerciseKey(ex.name);
      const p = key && pointOf(ex, w);
      if (!p) continue;
      const cur = map.get(key);
      if (!cur) {
        map.set(key, {
          key,
          name: ex.name.trim(),
          points: [p],
          best: { maxWeight: p.maxWeight, maxWeightDate: p.date, e1rm: p.e1rm, e1rmDate: p.date, maxReps: p.maxReps, maxRepsDate: p.date },
          last: p,
        });
        continue;
      }
      cur.name = ex.name.trim();
      cur.points.push(p);
      cur.last = p;
      if (p.maxWeight > cur.best.maxWeight) Object.assign(cur.best, { maxWeight: p.maxWeight, maxWeightDate: p.date });
      if (p.e1rm > cur.best.e1rm) Object.assign(cur.best, { e1rm: p.e1rm, e1rmDate: p.date });
      if (p.maxReps > cur.best.maxReps) Object.assign(cur.best, { maxReps: p.maxReps, maxRepsDate: p.date });
    }
  }
  return [...map.values()].sort((a, b) => b.last.date.localeCompare(a.last.date) || b.points.length - a.points.length);
}

/** Ce que le formulaire de séance doit savoir de chaque exercice (léger, sérialisable). */
export type ExerciseMemo = { name: string; maxWeight: number; e1rm: number; maxReps: number; lastDate: string; lastSets: ExerciseSet[] };

export function exerciseMemos(index: ExerciseSummary[]): Record<string, ExerciseMemo> {
  return Object.fromEntries(
    index.map((e) => [e.key, { name: e.name, maxWeight: e.best.maxWeight, e1rm: e.best.e1rm, maxReps: e.best.maxReps, lastDate: e.last.date, lastSets: e.last.sets }]),
  );
}

export type NewRecord = { name: string; kind: "charge" | "1RM" | "reps"; value: number; previous: number };

/**
 * Records battus par une séance, comparés à l'historique (sans cette séance).
 * Un exercice jamais fait avant n'est pas un record : il n'y a rien à battre.
 * Un seul record par exercice, le plus parlant : charge max > 1RM estimé > reps (poids du corps).
 */
export function detectRecords(memos: Record<string, ExerciseMemo>, exercises: Exercise[]): NewRecord[] {
  const out: NewRecord[] = [];
  for (const ex of exercises) {
    const prev = memos[exerciseKey(ex.name)];
    const p = prev && pointOf(ex, { id: 0, date: new Date() });
    if (!prev || !p) continue;
    if (p.maxWeight > 0 && p.maxWeight > prev.maxWeight) out.push({ name: ex.name, kind: "charge", value: p.maxWeight, previous: prev.maxWeight });
    else if (p.e1rm > 0 && p.e1rm > prev.e1rm + 0.05) out.push({ name: ex.name, kind: "1RM", value: p.e1rm, previous: prev.e1rm });
    else if (p.maxWeight === 0 && prev.maxWeight === 0 && p.maxReps > prev.maxReps) out.push({ name: ex.name, kind: "reps", value: p.maxReps, previous: prev.maxReps });
  }
  return out;
}

/** Une série bat-elle le record de l'exercice ? (badge en direct dans le formulaire) */
export function isRecordSet(memo: ExerciseMemo | undefined, s: ExerciseSet) {
  if (!memo) return false;
  const kg = s.weight ?? 0, reps = s.reps ?? 0;
  if (kg > 0) return kg > memo.maxWeight || (reps > 0 && e1rm(kg, reps) > memo.e1rm + 0.05);
  return memo.maxWeight === 0 && reps > memo.maxReps;
}

/** « 3×8 @ 60 kg » ou « 8, 8, 6 reps » */
export function formatSets(sets: ExerciseSet[]) {
  if (!sets.length) return "";
  const same = sets.every((s) => s.reps === sets[0].reps && s.weight === sets[0].weight);
  const kg = (w?: number) => (w ? ` @ ${round1(w)} kg` : "");
  if (same) return `${sets.length}×${sets[0].reps ?? "?"}${kg(sets[0].weight)}`;
  return sets.map((s) => `${s.reps ?? "?"}${s.weight ? `×${round1(s.weight)}` : ""}`).join(", ") + (sets.some((s) => s.weight) ? " kg" : " reps");
}
