import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, isValidSession } from "./auth";
import { listProfiles } from "./data";
import type { Profile } from "./schema";

/** Profil actif de l'appareil. Pas besoin de le signer : tout utilisateur connecté peut changer de profil. */
export const PROFILE_COOKIE = "fit_profile";

/** Cookies de session / profil : 1 an, inaccessibles au JS */
export const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: 60 * 60 * 24 * 365,
} as const;

/** Défense en profondeur (le proxy filtre déjà) + rend la page dynamique. */
export async function requireAuth() {
  const store = await cookies();
  if (!(await isValidSession(store.get(SESSION_COOKIE)?.value))) redirect("/login");
}

/** Profil choisi via le cookie ; s'il n'y a qu'un seul profil, il est sélectionné d'office. */
export const getActiveProfile = cache(async (): Promise<Profile | null> => {
  const [store, all] = await Promise.all([cookies(), listProfiles()]);
  const id = Number(store.get(PROFILE_COOKIE)?.value);
  return all.find((p) => p.id === id) ?? (all.length === 1 ? all[0] : null);
});

/** Connecté + profil actif, sinon redirection vers la connexion ou le sélecteur de profils. */
export async function requireProfile(): Promise<Profile> {
  await requireAuth();
  const p = await getActiveProfile();
  if (!p) redirect("/profiles");
  return p;
}
