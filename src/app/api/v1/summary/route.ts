import { json, profileFromRequest, unauthorized } from "@/lib/api-auth";
import { buildSummary } from "@/lib/summary";

export const dynamic = "force-dynamic";

/** Résumé du profil pour le widget d'écran d'accueil (Scriptable). */
export async function GET(req: Request) {
  const p = await profileFromRequest(req);
  if (!p) return unauthorized();
  return json(await buildSummary(p, new URL(req.url).origin));
}
