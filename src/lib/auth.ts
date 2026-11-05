export const SESSION_COOKIE = "fit_session";

const enc = new TextEncoder();

async function hmac(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(msg));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET manquant ou trop court (≥16 car.)");
  return s;
}

/** Jeton de session dérivé du secret + mot de passe : changer l'un invalide les sessions. */
export async function sessionToken(): Promise<string> {
  return hmac(secret(), `session:v1:${process.env.APP_PASSWORD ?? ""}`);
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  return safeEqual(token, await sessionToken());
}

/**
 * Jeton du flux calendrier d'un profil, dérivé de CALENDAR_TOKEN.
 * Le profil 1 garde le jeton brut : les abonnements créés avant le multi-profils continuent de marcher.
 */
export async function calendarToken(profileId: number): Promise<string | null> {
  const base = process.env.CALENDAR_TOKEN;
  if (!base || base.length < 16) return null;
  if (profileId === 1) return base;
  return `${profileId}-${(await hmac(base, `calendar:${profileId}`)).slice(0, 32)}`;
}

/** Profil correspondant à un jeton de flux calendrier, ou null si le jeton est invalide. */
export async function profileIdFromCalendarToken(token: string): Promise<number | null> {
  const m = /^(\d{1,9})-[0-9a-f]{32}$/.exec(token);
  const id = m ? Number(m[1]) : 1;
  const expected = await calendarToken(id);
  return expected && safeEqual(token, expected) ? id : null;
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = process.env.APP_PASSWORD;
  if (!expected) return false;
  // Compare des HMAC (longueur fixe) pour éviter les fuites de timing
  const [a, b] = await Promise.all([hmac(secret(), `pw:${input}`), hmac(secret(), `pw:${expected}`)]);
  return safeEqual(a, b);
}
