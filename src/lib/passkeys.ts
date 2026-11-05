import "server-only";
import { headers } from "next/headers";

export const WEBAUTHN_COOKIE = "fit_webauthn";
export const CHALLENGE_TTL_MS = 5 * 60_000;

/** Relying Party = le domaine de l'app (les passkeys iCloud y sont liées). */
export async function relyingParty() {
  const h = await headers();
  const host = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000").split(",")[0].trim();
  const local = /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host);
  const proto = (h.get("x-forwarded-proto") ?? (local ? "http" : "https")).split(",")[0].trim();
  return { rpName: "FitPulse", rpID: host.replace(/:\d+$/, "").replace(/^\[|\]$/g, ""), origin: `${proto}://${host}` };
}

/** Nom lisible de l'appareil, déduit du User-Agent (affiché dans la liste des passkeys). */
export async function deviceLabel() {
  const ua = (await headers()).get("user-agent") ?? "";
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android";
  if (/Windows/.test(ua)) return "PC Windows";
  return "Appareil";
}
