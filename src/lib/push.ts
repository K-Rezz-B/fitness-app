import "server-only";
import webpush from "web-push";
import { eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { pushSubscriptions, type Profile } from "./schema";
import { getWorkouts } from "./data";
import { computeStats } from "./stats";
import { badgeMessage, newBadges, type PushPayload } from "./notifications";

export const vapidPublicKey = () => process.env.VAPID_PUBLIC_KEY ?? null;
export const pushConfigured = () => Boolean(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

let ready = false;
function setup() {
  if (ready) return;
  // Apple exige un « subject » valide : mailto: ou URL https de l'app
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  const subject = process.env.VAPID_SUBJECT ?? (prod ? `https://${prod}` : "mailto:fitpulse@example.invalid");
  webpush.setVapidDetails(subject, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
  ready = true;
}

/** Envoie à tous les appareils du profil ; supprime les abonnements expirés (404/410). */
export async function sendToProfile(pid: number, payload: PushPayload): Promise<{ sent: number; removed: number }> {
  if (!pushConfigured()) return { sent: 0, removed: 0 };
  setup();
  const subs = await db.select().from(pushSubscriptions).where(eq(pushSubscriptions.profileId, pid));
  const dead: number[] = [];
  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 60 * 12, urgency: "normal", topic: payload.tag },
        );
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) dead.push(s.id);
        else console.error("[push] échec", code, (e as Error).message);
      }
    }),
  );
  if (dead.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, dead));
  return { sent, removed: dead.length };
}

/** Après l'ajout d'une séance : notifie les badges débloqués par celle-ci. */
export async function notifyNewBadges(p: Profile, newWorkoutId: number) {
  if (!p.notifyBadges || !pushConfigured()) return;
  const all = await getWorkouts(p.id);
  const after = computeStats(all, p.weeklySessionsTarget);
  const before = computeStats(
    all.filter((w) => w.id !== newWorkoutId),
    p.weeklySessionsTarget,
  );
  const msg = badgeMessage(newBadges(before, after), after);
  if (msg) await sendToProfile(p.id, msg);
}
