// Contenu des notifications push (fonctions pures, testables).
import type { Stats } from "./stats";

export type PushPayload = { title: string; body: string; url?: string; badge?: number; tag?: string };

/** Pastille sur l'icône : séances restantes pour l'objectif de la semaine. */
export const remainingThisWeek = (s: Stats) => Math.max(0, s.weeklyTarget - s.current.sessions);

export function newBadges(before: Stats, after: Stats) {
  const had = new Set(before.badges.filter((b) => b.got).map((b) => b.id));
  return after.badges.filter((b) => b.got && !had.has(b.id));
}

export function badgeMessage(fresh: Stats["badges"], after: Stats): PushPayload | null {
  if (!fresh.length) return null;
  return {
    title: fresh.length > 1 ? "🏆 Nouveaux badges !" : "🏆 Nouveau badge !",
    body: fresh.map((b) => `${b.emoji} ${b.label}`).join(" · "),
    url: "/",
    badge: remainingThisWeek(after),
    tag: "badge",
  };
}

/** Notification du soir (1 max / jour) : bilan le dimanche, sinon rappel si rien n'est fait. */
export function dailyMessage(
  s: Stats,
  o: {
    weekday: number; // 1 = lundi … 7 = dimanche
    workedOutToday: boolean;
    plannedToday: { title: string; time: string }[];
    notifyStreak: boolean;
    notifyWeekly: boolean;
  },
): PushPayload | null {
  const badge = remainingThisWeek(s);
  if (o.weekday === 7 && o.notifyWeekly) {
    const c = s.current;
    const ok = c.sessions >= s.weeklyTarget;
    return {
      title: ok ? "🏆 Semaine validée !" : "📊 Bilan de la semaine",
      body: `${c.sessions}/${s.weeklyTarget} séances · ${c.minutes} min · score ${s.score}/100${ok ? ` · série ${s.weekStreak} sem. 🔥` : " — on remet ça lundi 💪"}`,
      url: "/",
      badge,
      tag: "weekly",
    };
  }
  if (!o.notifyStreak || o.workedOutToday) return null;
  const daysLeft = 8 - o.weekday; // aujourd'hui inclus
  if (o.plannedToday.length) {
    const p = o.plannedToday[0];
    return {
      title: "⏳ Séance prévue aujourd'hui",
      body: `${p.title} (${p.time}) n'est pas encore validée.${s.dayStreak >= 2 ? ` Ta série de ${s.dayStreak} jours compte sur toi 🔥` : ""}`,
      url: "/",
      badge,
      tag: "daily",
    };
  }
  if (s.dayStreak >= 2)
    return {
      title: "🔥 Ta série est en danger",
      body: `${s.dayStreak} jours d'affilée — une petite séance ce soir pour la garder ?`,
      url: "/workouts/new",
      badge,
      tag: "daily",
    };
  if (badge > 0 && badge >= daysLeft)
    return {
      title: "🎯 Objectif de la semaine",
      body: `Encore ${badge} séance(s) et il reste ${daysLeft} jour(s) : c'est le moment !`,
      url: "/workouts/new",
      badge,
      tag: "daily",
    };
  return null;
}
