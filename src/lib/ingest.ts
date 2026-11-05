// Normalisation des données envoyées par Raccourcis (Apple Santé / Apple Watch).
// Fonctions pures, tolérantes : Raccourcis envoie souvent des chaînes avec unités ("5,2 km", "42 min").
import { typeInfo, TYPE_BY_ID } from "./constants";
import { dayKey } from "./dates";

type Body = Record<string, unknown>;
type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const norm = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

/** Noms d'exercices Apple (FR/EN) → type FitPulse. Ordre = priorité (le plus spécifique d'abord). */
const APPLE_TYPES: [string, string[]][] = [
  ["hiit", ["hiit", "intervalle", "high intensity", "haute intensite"]],
  ["crossfit", ["fonctionnel", "functional", "crossfit", "cross training", "cross-training"]],
  ["yoga", ["yoga"]],
  ["mobilite", ["etirement", "stretch", "souplesse", "flexibilit", "mobilit", "recuperation", "cooldown", "cool down", "tai chi", "mind"]],
  ["natation", ["natation", "swim", "nage", "piscine"]],
  ["velo", ["velo", "cycl", "bike", "vtt", "spinning"]],
  ["course", ["course", "running", "run", "jogging", "footing", "trail"]],
  ["marche", ["marche", "walk", "randonnee", "hike", "hiking"]],
  ["boxe", ["boxe", "boxing", "kickbox", "martial", "combat", "mma", "judo", "karate"]],
  ["sport", ["football", "soccer", "basket", "tennis", "padel", "rugby", "handball", "volley", "badminton", "squash", "golf", "ski", "escalade", "climb", "hockey"]],
  ["calisthenics", ["poids du corps", "calisthenics", "core", "tronc", "pilates", "barre"]],
  ["muscu", ["musculation", "strength", "weight", "halterophil", "renforcement"]],
  ["cardio", ["elliptique", "elliptical", "rameur", "rowing", "row", "stair", "escalier", "stepper", "cardio", "danse", "dance"]],
];

export function mapWorkoutType(raw: unknown): string {
  if (typeof raw !== "string" || !raw.trim()) return "cardio";
  if (TYPE_BY_ID[raw.trim()]) return raw.trim();
  const n = norm(raw);
  for (const [id, words] of APPLE_TYPES) if (words.some((w) => n.includes(w))) return id;
  return "cardio";
}

/** Premier nombre d'une valeur ("1 234,5 kcal" → 1234.5). */
export function parseNumber(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string") return null;
  const s = v.replace(/(\d)[\s  ](?=\d{3}(?:\D|$))/g, "$1");
  const m = /-?\d+(?:[.,]\d+)?/.exec(s);
  return m ? Number(m[0].replace(",", ".")) : null;
}

const unitOf = (v: unknown) => (typeof v === "string" ? norm(v).replace(/[\d\s.,-]/g, "") : "");

export function parseDistanceKm(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null || n <= 0) return null;
  const u = unitOf(v);
  if (u.startsWith("mi")) return n * 1.609344;
  if (u === "m") return n / 1000;
  return n;
}

export function parseCalories(v: unknown): number | null {
  const n = parseNumber(v);
  if (n === null || n <= 0) return null;
  return Math.round(unitOf(v).startsWith("kj") ? n / 4.184 : n);
}

/** "1:05:30", "42:10", "1 h 5 min", "42 min", "3600 s" → minutes */
export function parseDurationText(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v !== "string" || !v.trim()) return null;
  const s = norm(v);
  const clock = /^(\d+):(\d{1,2})(?::(\d{1,2}))?$/.exec(s);
  if (clock) {
    const [a, b, c] = [Number(clock[1]), Number(clock[2]), clock[3] ? Number(clock[3]) : null];
    return c === null ? a + b / 60 : a * 60 + b + c / 60;
  }
  let total = 0;
  let found = false;
  for (const m of s.matchAll(/(\d+(?:[.,]\d+)?)\s*(h|heures?|hours?|min|minutes?|mn|m|s|sec|secondes?|seconds?)\b/g)) {
    const n = Number(m[1].replace(",", "."));
    const u = m[2];
    total += u.startsWith("h") ? n * 60 : u.startsWith("s") ? n / 60 : n;
    found = true;
  }
  if (found) return total;
  return parseNumber(s); // nombre seul = minutes
}

/** ISO 8601 (recommandé : action « Formater la date » › ISO 8601) ou timestamp (s ou ms). */
export function parseDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v === "number" || (typeof v === "string" && /^\d{9,13}$/.test(v.trim()))) {
    const n = Number(v);
    const d = new Date(n < 1e12 ? n * 1000 : n);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof v !== "string") return null;
  const d = new Date(v.trim());
  return isNaN(d.getTime()) ? null : d;
}

/** RPE estimé depuis la FC moyenne (% FCmax théorique, Borg CR10 approx.) */
export function estimateRpe(hrAvg: number | null, age: number | null): number | null {
  if (!hrAvg || !age || hrAvg < 50 || hrAvg > 230) return null;
  const pct = hrAvg / (220 - age);
  return Math.min(10, Math.max(1, Math.round((pct - 0.5) * 20)));
}

/** Formule déjà utilisée dans le formulaire de séance : MET × 3,5 × kg × min / 200 */
export const estimateCalories = (met: number, kg: number, minutes: number) => Math.round((met * 3.5 * kg * minutes) / 200);

const pick = (b: Body, ...keys: string[]) => {
  for (const k of keys) if (b[k] !== undefined && b[k] !== null && b[k] !== "") return b[k];
  return undefined;
};

export type ImportedWorkout = {
  type: string;
  title: string;
  date: Date;
  durationMin: number;
  rpe: number;
  distanceKm: number | null;
  calories: number | null;
  notes: string;
  externalId: string;
};

export function normalizeWorkout(
  b: Body,
  ctx: { age: number | null; kg: number | null; now: Date },
): Result<ImportedWorkout> {
  const rawType = pick(b, "type", "workoutType", "activity", "name", "nom");
  const type = mapWorkoutType(rawType);
  const end = parseDate(pick(b, "end", "endDate", "fin"));
  let start = parseDate(pick(b, "start", "startDate", "date", "debut"));

  const durSec = parseNumber(pick(b, "durationSec", "durationSeconds"));
  let duration =
    parseNumber(pick(b, "durationMin", "minutes")) ??
    (durSec !== null ? durSec / 60 : null) ??
    parseDurationText(pick(b, "duration", "duree"));
  if (duration === null && start && end) duration = (end.getTime() - start.getTime()) / 60_000;
  if (duration === null || !(duration >= 1) || duration > 1440)
    return { ok: false, error: "Durée manquante ou invalide (durationMin, duration, ou start + end)" };
  duration = Math.round(duration);

  if (!start) start = new Date((end ?? ctx.now).getTime() - duration * 60_000);
  if (start.getTime() > ctx.now.getTime() + 5 * 60_000) return { ok: false, error: "Date de début dans le futur" };

  const info = typeInfo(type);
  const hr = parseNumber(pick(b, "heartRateAvg", "avgHeartRate", "hr", "fc"));
  const rpeIn = parseNumber(pick(b, "rpe"));
  const rpe = rpeIn !== null ? Math.min(10, Math.max(1, Math.round(rpeIn))) : (estimateRpe(hr, ctx.age) ?? 6);
  const calories =
    parseCalories(pick(b, "calories", "activeEnergy", "energy", "energie")) ??
    (ctx.kg ? estimateCalories(info.met, ctx.kg, duration) : null);
  const distanceKm = info.hasDistance ? parseDistanceKm(pick(b, "distanceKm", "distance")) : null;
  const title = (typeof rawType === "string" && rawType.trim() && !TYPE_BY_ID[rawType.trim()] ? rawType.trim() : info.label).slice(0, 120);
  const ext = pick(b, "id", "externalId", "uuid");
  const minute = new Date(Math.floor(start.getTime() / 60_000) * 60_000).toISOString();

  return {
    ok: true,
    value: {
      type,
      title: typeof b.title === "string" && b.title.trim() ? b.title.trim().slice(0, 120) : title,
      date: start,
      durationMin: duration,
      rpe,
      distanceKm: distanceKm !== null ? Math.round(distanceKm * 100) / 100 : null,
      calories,
      notes: `⌚ Importée depuis Apple Santé${hr ? ` · FC moy. ${Math.round(hr)} bpm` : ""}${rpeIn === null && estimateRpe(hr, ctx.age) ? " · RPE estimé depuis la FC" : ""}`,
      externalId: typeof ext === "string" || typeof ext === "number" ? `ext:${String(ext).slice(0, 100)}` : `ah:${minute}`,
    },
  };
}

export type ImportedWeight = { date: string; weightKg: number; bodyFatPct: number | null };

export function normalizeWeight(b: Body, now: Date): Result<ImportedWeight> {
  const raw = pick(b, "weightKg", "weight", "poids", "value", "valeur");
  let kg = parseNumber(raw);
  if (kg !== null && unitOf(raw).startsWith("lb")) kg *= 0.45359237;
  if (kg === null || kg < 20 || kg > 400) return { ok: false, error: "Poids manquant ou invalide (weightKg)" };
  const d = parseDate(pick(b, "date", "startDate"));
  let bf = parseNumber(pick(b, "bodyFatPct", "bodyFat", "masseGrasse"));
  if (bf !== null && bf > 0 && bf <= 1) bf *= 100; // Santé exprime parfois la masse grasse en fraction
  return {
    ok: true,
    value: {
      date: dayKey(d ?? now),
      weightKg: Math.round(kg * 10) / 10,
      bodyFatPct: bf !== null && bf > 0 && bf < 70 ? Math.round(bf * 10) / 10 : null,
    },
  };
}
