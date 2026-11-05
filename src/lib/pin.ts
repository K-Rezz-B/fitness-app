import "server-only";
import { and, eq, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "./db";
import { profile } from "./schema";
import { safeEqual } from "./auth";

/** Code PIN d'un profil : 4 à 6 chiffres. */
export const PIN_RE = /^\d{4,6}$/;
/** Essais ratés avant blocage (15 min, puis doublé à chaque nouvel échec, 24 h max). */
export const PIN_MAX_TRIES = 5;

const ITERATIONS = 100_000;
const enc = new TextEncoder();
const b64 = (buf: ArrayBuffer | Uint8Array) => Buffer.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).toString("base64url");

async function derive(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(pin), "PBKDF2", false, ["deriveBits"]);
  return b64(await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256));
}

/** Empreinte stockée : `pbkdf2$<itérations>$<sel>$<hash>` (le code n'est jamais stocké en clair). */
export async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `pbkdf2$${ITERATIONS}$${b64(salt)}$${await derive(pin, salt, ITERATIONS)}`;
}

export async function verifyPin(pin: string, stored: string | null): Promise<boolean> {
  const [algo, it, salt, hash] = (stored ?? "").split("$");
  const iterations = Number(it);
  if (algo !== "pbkdf2" || !salt || !hash || !Number.isInteger(iterations) || iterations < 1 || !PIN_RE.test(pin)) return false;
  return safeEqual(await derive(pin, new Uint8Array(Buffer.from(salt, "base64url")), iterations), hash);
}

/** Nouveau code saisi deux fois (`pin` + `pinConfirm`) : message d'erreur, ou null s'il est valide. */
export function newPinError(pin: string, confirm: string): string | null {
  if (!PIN_RE.test(pin)) return "Le code doit faire 4 à 6 chiffres.";
  if (pin !== confirm) return "Les deux codes ne correspondent pas.";
  return null;
}

const MAX = sql.raw(String(PIN_MAX_TRIES));

/** Message affiché quand on ne peut pas (ou plus) tenter de code. */
async function blockedMessage(id: number): Promise<string> {
  const [p] = await db.select({ pinHash: profile.pinHash, until: profile.pinLockedUntil }).from(profile).where(eq(profile.id, id));
  if (!p) return "Profil introuvable.";
  if (!p.pinHash) return "Ce profil n'a pas encore de code.";
  const min = Math.max(1, Math.ceil(((p.until?.getTime() ?? 0) - Date.now()) / 60_000));
  const wait = min > 90 ? `${Math.round(min / 60)} h` : `${min} min`;
  return `Trop d'essais : réessaie dans ${wait} (ou déverrouille avec Face ID).`;
}

export type PinCheck = { ok: true; pinHash: string } | { ok: false; error: string };

/**
 * Vérifie le code d'un profil, avec limitation des essais.
 * L'essai est réservé de façon atomique (compteur + blocage dans le même UPDATE) :
 * des requêtes envoyées en rafale ne peuvent pas dépasser la limite.
 */
export async function checkProfilePin(id: number, pin: string): Promise<PinCheck> {
  const tries = sql`(${profile.pinFailedAttempts} + 1)`;
  const [row] = await db
    .update(profile)
    .set({
      pinFailedAttempts: tries,
      pinLockedUntil: sql`case when ${tries} >= ${MAX} then now() + least(15 * power(2, ${tries} - ${MAX}), 1440) * interval '1 minute' end`,
    })
    .where(and(eq(profile.id, id), isNotNull(profile.pinHash), or(isNull(profile.pinLockedUntil), lte(profile.pinLockedUntil, sql`now()`))))
    .returning({ pinHash: profile.pinHash, tries: profile.pinFailedAttempts });
  if (!row?.pinHash) return { ok: false, error: await blockedMessage(id) };

  if (await verifyPin(pin, row.pinHash)) {
    await resetPinAttempts(id);
    return { ok: true, pinHash: row.pinHash };
  }
  await new Promise((r) => setTimeout(r, 600)); // ralentit le brute-force
  const left = PIN_MAX_TRIES - row.tries;
  if (left <= 0) return { ok: false, error: await blockedMessage(id) };
  return { ok: false, error: `Code incorrect — encore ${left} essai${left > 1 ? "s" : ""}.` };
}

/** Après un code correct ou un Face ID réussi. Renvoie le profil (id + empreinte) pour le déverrouiller. */
export async function resetPinAttempts(id: number) {
  const [p] = await db
    .update(profile)
    .set({ pinFailedAttempts: 0, pinLockedUntil: null })
    .where(eq(profile.id, id))
    .returning({ id: profile.id, pinHash: profile.pinHash });
  return p ?? null;
}
