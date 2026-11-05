import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession, signValue, verifySigned } from "./auth";
import { listProfiles } from "./data";
import type { Profile } from "./schema";

/**
 * Profil déverrouillé sur cet appareil : cookie signé `id.expiration.signature`.
 * La signature inclut l'empreinte du code du profil : impossible de forger le cookie pour ouvrir
 * un autre profil, et changer son code reverrouille tous les autres appareils.
 */
export const PROFILE_COOKIE = "fit_profile";

/** Cookies de session / profil : 1 an, inaccessibles au JS */
export const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

const unlockPurpose = (pinHash: string | null) => `profile:${pinHash ?? ""}`;

/** Ouvre le profil sur cet appareil (après code PIN, Face ID ou création). Server actions uniquement. */
export async function setUnlockedProfile(p: { id: number; pinHash: string | null }) {
  const value = await signValue(unlockPurpose(p.pinHash), String(p.id), COOKIE_OPTS.maxAge * 1000);
  (await cookies()).set(PROFILE_COOKIE, value, COOKIE_OPTS);
}

/** Défense en profondeur (le proxy filtre déjà) + rend la page dynamique. */
export async function requireAuth() {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) redirect("/login");
}

/** Profil déverrouillé sur cet appareil, ou null (même s'il n'y a qu'un profil : chacun est verrouillé). */
export const getActiveProfile = cache(async (): Promise<Profile | null> => {
  const [store, all] = await Promise.all([cookies(), listProfiles()]);
  const raw = store.get(PROFILE_COOKIE)?.value;
  const p = raw ? all.find((x) => String(x.id) === raw.split(".")[0]) : undefined;
  return p && (await verifySigned(unlockPurpose(p.pinHash), raw)) === String(p.id) ? p : null;
});

/** Connecté + profil déverrouillé (et protégé par un code), sinon connexion / sélecteur / création du code. */
export async function requireProfile(): Promise<Profile> {
  await requireAuth();
  const p = await getActiveProfile();
  if (!p) redirect("/profiles");
  if (!p.pinHash) redirect(`/profiles/${p.id}`); // profil d'avant le verrou, ouvert par Face ID : définir son code
  return p;
}
