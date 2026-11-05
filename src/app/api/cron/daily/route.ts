import { inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { profile, pushSubscriptions } from "@/lib/schema";
import { getPlans, getWorkouts } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { dailyMessage } from "@/lib/notifications";
import { pushConfigured, sendToProfile } from "@/lib/push";
import { safeEqual } from "@/lib/auth";
import { json } from "@/lib/api-auth";
import { dayKey, isoWeekday, today } from "@/lib/dates";
import { typeInfo } from "@/lib/constants";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Cron Vercel quotidien (vercel.json) : rappel du soir / bilan du dimanche, par profil abonné. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) return new Response("Unauthorized", { status: 401 });
  if (!pushConfigured()) return json({ ok: false, error: "VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY manquantes" });

  const ids = [...new Set((await db.select({ id: pushSubscriptions.profileId }).from(pushSubscriptions)).map((r) => r.id))];
  const profiles = ids.length ? await db.select().from(profile).where(inArray(profile.id, ids)) : [];
  const t = today();
  const weekday = isoWeekday(t);
  const results = [];
  for (const p of profiles) {
    const [all, plans] = await Promise.all([getWorkouts(p.id), getPlans(p.id)]);
    const s = computeStats(all, p.weeklySessionsTarget);
    const doneToday = all.filter((w) => dayKey(w.date) === t);
    const plannedToday = plans
      .filter((x) => x.active && x.weekday === weekday)
      .filter((x) => !doneToday.some((w) => typeInfo(w.type).category === typeInfo(x.type).category));
    const msg = dailyMessage(s, {
      weekday,
      workedOutToday: doneToday.length > 0,
      plannedToday,
      notifyStreak: p.notifyStreak,
      notifyWeekly: p.notifyWeekly,
    });
    results.push({ profile: p.id, title: msg?.title ?? null, ...(msg ? await sendToProfile(p.id, msg) : { sent: 0, removed: 0 }) });
  }
  return json({ ok: true, day: t, results });
}
