import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./db";
import { profile, type Profile } from "./schema";

/** Jeton d'intégration (Raccourcis, widget) : 32 octets aléatoires en hex. */
export const newApiToken = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) => b.toString(16).padStart(2, "0")).join("");

/** Profil désigné par `Authorization: Bearer <jeton>`, ou null. */
export async function profileFromRequest(req: Request): Promise<Profile | null> {
  const m = /^Bearer\s+([0-9a-f]{64})$/i.exec((req.headers.get("authorization") ?? "").trim());
  if (!m) return null;
  const [p] = await db.select().from(profile).where(eq(profile.apiToken, m[1].toLowerCase()));
  return p ?? null;
}

export const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

/** Réponse d'erreur lisible dans une notification Raccourcis (`message`). */
export const fail = (status: number, error: string) => json({ ok: false, error, message: `❌ FitPulse : ${error}` }, status);

export const unauthorized = () => fail(401, "jeton invalide (en-tête Authorization: Bearer <jeton>, voir la page Apple)");

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
