import { typeInfo } from "./constants";
import { addDays, dayKey, isoWeekday } from "./dates";
import type { Plan, PlanMove, Workout } from "./schema";

/** Une séance datée : occurrence d'un créneau hebdo, ou séance décalée. */
export type Session = {
  key: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  planId: number | null;
  moveId: number | null;
  /** Date d'origine si la séance a été décalée */
  movedFrom: string | null;
  title: string;
  type: string;
  durationMin: number;
  reminderMin: number;
  source: string;
  templateId: string | null;
  rpe: number | null;
  notes: string | null;
  done: boolean;
};

/** Premier jour où un créneau compte : sa création, ou la semaine pour laquelle le coach l'a générée. */
const startOf = (p: Plan) => {
  const created = dayKey(p.createdAt);
  return p.source === "coach" && p.weekStart && p.weekStart > created ? p.weekStart : created;
};

/**
 * Séances du `from` au `to` inclus : créneaux hebdo actifs, moins les occurrences décalées/sautées,
 * plus les séances décalées vers ces jours. Une séance est faite si une séance loggée le même jour
 * est de la même catégorie (chaque séance loggée ne valide qu'une séance prévue).
 */
export function sessionsBetween(plans: Plan[], moves: PlanMove[], workouts: Workout[], from: string, to: string): Session[] {
  const out: Session[] = [];
  const movedAway = new Set(moves.filter((m) => m.planId).map((m) => `${m.planId}:${m.fromDate}`));
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const wd = isoWeekday(d);
    for (const p of plans) {
      if (!p.active || p.weekday !== wd || d < startOf(p) || movedAway.has(`${p.id}:${d}`)) continue;
      out.push({
        key: `p${p.id}-${d}`, date: d, time: p.time, planId: p.id, moveId: null, movedFrom: null,
        title: p.title, type: p.type, durationMin: p.durationMin, reminderMin: p.reminderMin, source: p.source,
        templateId: p.templateId, rpe: p.rpe, notes: p.notes, done: false,
      });
    }
  }
  for (const m of moves) {
    if (!m.toDate || m.toDate < from || m.toDate > to) continue;
    out.push({
      key: `m${m.id}`, date: m.toDate, time: m.toTime, planId: m.planId, moveId: m.id, movedFrom: m.fromDate,
      title: m.title, type: m.type, durationMin: m.durationMin, reminderMin: 30, source: m.source,
      templateId: m.templateId, rpe: m.rpe, notes: m.notes, done: false,
    });
  }
  out.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  const used = new Set<number>();
  for (const s of out) {
    const w = workouts.find((w) => !used.has(w.id) && dayKey(w.date) === s.date && typeInfo(w.type).category === typeInfo(s.type).category);
    if (w) {
      used.add(w.id);
      s.done = true;
    }
  }
  return out;
}

/** Lien pour démarrer une séance prévue (prescription du coach si le créneau existe encore). */
export function sessionHref(s: Session) {
  if (s.source === "coach" && s.planId && s.templateId) return `/workouts/new?plan=${s.planId}`;
  if (s.templateId) return `/workouts/new?template=${s.templateId}`;
  return `/workouts/new?type=${s.type}&title=${encodeURIComponent(s.title)}&duration=${s.durationMin}`;
}

/** « aujourd'hui », « demain », « hier », sinon « lundi 9 nov. » */
export function dayLabel(date: string, t: string) {
  if (date === t) return "aujourd'hui";
  if (date === addDays(t, 1)) return "demain";
  if (date === addDays(t, -1)) return "hier";
  return new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

/** Prochaine séance non faite à partir de maintenant (`hhmm` aujourd'hui). */
export const nextSession = (list: Session[], t: string, hhmm: string) =>
  list.find((s) => !s.done && (s.date > t || (s.date === t && s.time > hhmm)));
