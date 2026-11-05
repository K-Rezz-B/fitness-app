"use server";
// Server actions des intégrations Apple : jeton Raccourcis/widget, notifications push, passkeys Face ID.

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { db } from "@/lib/db";
import { passkeys, profile, pushSubscriptions } from "@/lib/schema";
import { SESSION_COOKIE, sessionToken, signValue, verifySigned } from "@/lib/auth";
import { COOKIE_OPTS, requireAuth, requireProfile, setUnlockedProfile } from "@/lib/session";
import { resetPinAttempts } from "@/lib/pin";
import { newApiToken } from "@/lib/api-auth";
import { pushConfigured, sendToProfile } from "@/lib/push";
import { getWorkouts } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { remainingThisWeek } from "@/lib/notifications";
import { CHALLENGE_TTL_MS, WEBAUTHN_COOKIE, deviceLabel, relyingParty } from "@/lib/passkeys";

const refresh = () => revalidatePath("/integrations");
const challengeCookie = { ...COOKIE_OPTS, sameSite: "strict", maxAge: CHALLENGE_TTL_MS / 1000 } as const;

// ---------- jeton d'intégration ----------
export async function generateApiToken() {
  const me = await requireProfile();
  await db.update(profile).set({ apiToken: newApiToken() }).where(eq(profile.id, me.id));
  refresh();
}

export async function revokeApiToken() {
  const me = await requireProfile();
  await db.update(profile).set({ apiToken: null }).where(eq(profile.id, me.id));
  refresh();
}

// ---------- notifications push ----------
type SubJSON = { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } };

export async function savePushSubscription(sub: SubJSON): Promise<string | null> {
  const me = await requireProfile();
  const endpoint = typeof sub?.endpoint === "string" ? sub.endpoint : "";
  const p256dh = typeof sub?.keys?.p256dh === "string" ? sub.keys.p256dh : "";
  const auth = typeof sub?.keys?.auth === "string" ? sub.keys.auth : "";
  if (!/^https:\/\/\S{10,2000}$/.test(endpoint) || !/^[\w-]{20,200}$/.test(p256dh) || !/^[\w-]{8,100}$/.test(auth))
    return "Abonnement invalide";
  const userAgent = await deviceLabel();
  // Un appareil = un abonnement : s'il change de profil, l'abonnement suit
  await db
    .insert(pushSubscriptions)
    .values({ profileId: me.id, endpoint, p256dh, auth, userAgent })
    .onConflictDoUpdate({ target: pushSubscriptions.endpoint, set: { profileId: me.id, p256dh, auth, userAgent } });
  refresh();
  return null;
}

export async function deletePushSubscription(endpoint: string) {
  const me = await requireProfile();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, String(endpoint)), eq(pushSubscriptions.profileId, me.id)));
  refresh();
}

export async function sendTestPush(): Promise<string> {
  const me = await requireProfile();
  if (!pushConfigured()) return "Notifications non configurées (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY).";
  const s = computeStats(await getWorkouts(me.id), me.weeklySessionsTarget);
  const { sent } = await sendToProfile(me.id, {
    title: "🔔 FitPulse",
    body: `Notifications actives pour ${me.name} 💪`,
    url: "/integrations",
    badge: remainingThisWeek(s),
    tag: "test",
  });
  return sent ? `Notification envoyée à ${sent} appareil(s).` : "Aucun appareil abonné pour ce profil.";
}

export async function saveNotificationPrefs(f: FormData) {
  const me = await requireProfile();
  await db
    .update(profile)
    .set({ notifyStreak: f.get("notifyStreak") === "on", notifyWeekly: f.get("notifyWeekly") === "on", notifyBadges: f.get("notifyBadges") === "on" })
    .where(eq(profile.id, me.id));
  refresh();
}

// ---------- passkeys (Face ID / Touch ID) ----------
export async function passkeyRegistrationOptions() {
  const me = await requireProfile();
  const rp = await relyingParty();
  const existing = await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.profileId, me.id));
  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userName: me.name || `Profil ${me.id}`,
    userDisplayName: `${me.name} · FitPulse`,
    // Identifiant stable par profil : réenregistrer sur le même appareil remplace l'ancienne passkey
    userID: new TextEncoder().encode(`fitpulse-profile-${me.id}`),
    attestationType: "none",
    excludeCredentials: existing.map((k) => ({ id: k.id, transports: k.transports })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  (await cookies()).set(WEBAUTHN_COOKIE, await signValue(`reg:${me.id}`, options.challenge, CHALLENGE_TTL_MS), challengeCookie);
  return options;
}

export async function verifyPasskeyRegistration(response: RegistrationResponseJSON): Promise<string | null> {
  const me = await requireProfile();
  const rp = await relyingParty();
  const store = await cookies();
  const challenge = await verifySigned(`reg:${me.id}`, store.get(WEBAUTHN_COOKIE)?.value);
  store.delete(WEBAUTHN_COOKIE);
  if (!challenge) return "Délai dépassé, réessaie.";
  try {
    const v = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      requireUserVerification: true,
    });
    if (!v.verified) return "Vérification refusée.";
    const c = v.registrationInfo.credential;
    await db
      .insert(passkeys)
      .values({
        id: c.id,
        profileId: me.id,
        publicKey: isoBase64URL.fromBuffer(c.publicKey),
        counter: c.counter,
        transports: c.transports ?? [],
        deviceName: await deviceLabel(),
      })
      .onConflictDoNothing();
  } catch (e) {
    return `Échec : ${(e as Error).message}`;
  }
  refresh();
  return null;
}

export async function deletePasskey(f: FormData) {
  const me = await requireProfile();
  await db.delete(passkeys).where(and(eq(passkeys.id, String(f.get("id") ?? "")), eq(passkeys.profileId, me.id)));
  refresh();
}

/** Challenge signé en cookie (5 min) lié à l'usage (`auth` = /login, `unlock:<id>` = déverrouillage d'un profil). */
async function authenticationOptions(purpose: string, allow?: { id: string; transports: string[] }[]) {
  const rp = await relyingParty();
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
    allowCredentials: allow,
  });
  (await cookies()).set(WEBAUTHN_COOKIE, await signValue(purpose, options.challenge, CHALLENGE_TTL_MS), challengeCookie);
  return options;
}

/** Vérifie une assertion Face ID / Touch ID : renvoie le profil propriétaire de la passkey, ou une erreur. */
async function verifyAssertion(purpose: string, response: AuthenticationResponseJSON): Promise<{ profileId: number } | { error: string }> {
  const rp = await relyingParty();
  const store = await cookies();
  const challenge = await verifySigned(purpose, store.get(WEBAUTHN_COOKIE)?.value);
  store.delete(WEBAUTHN_COOKIE);
  if (!challenge) return { error: "Délai dépassé, réessaie." };
  const [k] = await db.select().from(passkeys).where(eq(passkeys.id, String(response?.id ?? "")));
  if (!k) return { error: "Passkey inconnue (supprimée ?)." };
  try {
    const v = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: rp.origin,
      expectedRPID: rp.rpID,
      credential: { id: k.id, publicKey: isoBase64URL.toBuffer(k.publicKey), counter: k.counter, transports: k.transports },
      requireUserVerification: true,
    });
    if (!v.verified) return { error: "Vérification refusée." };
    await db.update(passkeys).set({ counter: v.authenticationInfo.newCounter, lastUsedAt: new Date() }).where(eq(passkeys.id, k.id));
  } catch (e) {
    return { error: `Échec : ${(e as Error).message}` };
  }
  return { profileId: k.profileId };
}

/** Face ID réussi : remet à zéro les essais de code et ouvre le profil sur cet appareil. */
async function unlockAfterPasskey(profileId: number) {
  const p = await resetPinAttempts(profileId);
  if (p) await setUnlockedProfile(p);
  revalidatePath("/", "layout");
}

/** Connexion sans mot de passe (page /login, hors session) : ouvre le profil de la passkey. */
export async function passkeyLoginOptions() {
  return authenticationOptions("auth");
}

export async function verifyPasskeyLogin(response: AuthenticationResponseJSON): Promise<string | null> {
  if (!process.env.APP_PASSWORD || !process.env.AUTH_SECRET) return "Configure APP_PASSWORD et AUTH_SECRET dans Vercel.";
  const r = await verifyAssertion("auth", response);
  if ("error" in r) return `${r.error} Connecte-toi avec le mot de passe.`;
  (await cookies()).set(SESSION_COOKIE, await sessionToken(), COOKIE_OPTS);
  await unlockAfterPasskey(r.profileId);
  redirect("/");
}

/** Sélecteur de profils : déverrouiller un profil précis avec une de ses passkeys. */
export async function passkeyUnlockOptions(profileId: number) {
  await requireAuth();
  const id = Number(profileId);
  const keys = Number.isInteger(id)
    ? await db.select({ id: passkeys.id, transports: passkeys.transports }).from(passkeys).where(eq(passkeys.profileId, id))
    : [];
  if (!keys.length) throw new Error("Face ID n'est pas activé pour ce profil.");
  return authenticationOptions(`unlock:${id}`, keys);
}

export async function verifyPasskeyUnlock(profileId: number, response: AuthenticationResponseJSON): Promise<string | null> {
  await requireAuth();
  const id = Number(profileId);
  const r = await verifyAssertion(`unlock:${id}`, response);
  if ("error" in r) return `${r.error} Utilise ton code.`;
  if (r.profileId !== id) return "Cette passkey appartient à un autre profil.";
  await unlockAfterPasskey(id);
  redirect("/");
}
