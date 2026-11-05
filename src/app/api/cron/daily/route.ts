import { db } from "@/lib/db";
import { pushSubscriptions } from "@/lib/schema";
import { getPlans, getWorkouts, listProfiles } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { dailyMessage, type PushPayload } from "@/lib/notifications";
import { pushConfigured, sendToProfile } from "@/lib/push";
import { generatePlan } from "@/lib/coach-plan";
import { PHASES, type WeekPlan } from "@/lib/planner";
import { safeEqual } from "@/lib/auth";
import { json } from "@/lib/api-auth";
import { addDays, dayKey, isoWeekday, today, weekStart } from "@/lib/dates";
import { WEEKDAYS, typeInfo } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const planMessage = (plan: WeekPlan): PushPayload | null => {
  const first = plan.sessions[0];
  if (!first) return null;
  return {
    title: "📅 Ton programme de la semaine est prêt",
    body: `${plan.sessions.length} séance(s) · ${PHASES[plan.phase].label}${plan.easyWeek && plan.phase !== 3 ? " (allégée)" : ""} — 1ʳᵉ : ${WEEKDAYS[first.weekday - 1].toLowerCase()} ${first.time}, ${first.title}`,
    url: "/planning#coach",
    tag: "plan",
  };
};

/**
 * Cron Vercel quotidien (vercel.json) :
 * 1. le dimanche, le coach prépare la semaine suivante des profils en mode auto ;
 * 2. rappel du soir / bilan du dimanche / programme prêt, par profil abonné aux notifications.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });

  const t = today();
  const weekday = isoWeekday(t);
  const profiles = await listProfiles();

  const replanned = new Map<number, WeekPlan>();
  if (weekday === 7) {
    const next = addDays(weekStart(t), 7);
    for (const p of profiles.filter((x) => x.planAuto && x.planDays.length)) {
      try {
        replanned.set(p.id, await generatePlan(p, next));
      } catch (e) {
        console.error("[cron] re-planification", p.id, (e as Error).message);
      }
    }
  }
  if (!pushConfigured()) return json({ ok: true, day: t, replanned: [...replanned.keys()], push: "VAPID non configuré" });

  const subscribed = new Set((await db.select({ id: pushSubscriptions.profileId }).from(pushSubscriptions)).map((r) => r.id));
  const results = [];
  for (const p of profiles.filter((x) => subscribed.has(x.id))) {
    const [all, plans] = await Promise.all([getWorkouts(p.id), getPlans(p.id)]);
    const s = computeStats(all, p.weeklySessionsTarget);
    const doneToday = all.filter((w) => dayKey(w.date) === t);
    const plannedToday = replanned.has(p.id)
      ? [] // les créneaux viennent d'être remplacés par ceux de la semaine prochaine
      : plans
          .filter((x) => x.active && x.weekday === weekday)
          .filter((x) => !doneToday.some((w) => typeInfo(w.type).category === typeInfo(x.type).category));
    const msgs = [
      dailyMessage(s, { weekday, workedOutToday: doneToday.length > 0, plannedToday, notifyStreak: p.notifyStreak, notifyWeekly: p.notifyWeekly }),
      replanned.has(p.id) ? planMessage(replanned.get(p.id)!) : null,
    ].filter((m): m is PushPayload => !!m);
    let sent = 0;
    let removed = 0;
    for (const m of msgs) {
      const r = await sendToProfile(p.id, m);
      sent += r.sent;
      removed += r.removed;
    }
    results.push({ profile: p.id, titles: msgs.map((m) => m.title), sent, removed });
  }
  return json({ ok: true, day: t, replanned: [...replanned.keys()], results });
}
