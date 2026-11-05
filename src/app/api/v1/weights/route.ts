import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { weights } from "@/lib/schema";
import { fail, json, profileFromRequest, readJson, unauthorized } from "@/lib/api-auth";
import { normalizeWeight } from "@/lib/ingest";
import { fmtDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

/** Import d'une pesée depuis Raccourcis : { weightKg | weight, date?, bodyFatPct? } */
export async function POST(req: Request) {
  const p = await profileFromRequest(req);
  if (!p) return unauthorized();
  const body = await readJson(req);
  if (!body || typeof body !== "object" || Array.isArray(body)) return fail(400, "corps JSON attendu");
  const n = normalizeWeight(body as Record<string, unknown>, new Date());
  if (!n.ok) return fail(422, n.error);
  const { date, weightKg, bodyFatPct } = n.value;

  // Raccourci lancé chaque jour : même pesée déjà présente → on ne la double pas
  const same = await db
    .select({ id: weights.id, kg: weights.weightKg })
    .from(weights)
    .where(and(eq(weights.profileId, p.id), eq(weights.date, date)));
  if (same.some((w) => Math.abs(w.kg - weightKg) < 0.05))
    return json({ ok: true, status: "duplicate", message: `ℹ️ Pesée du ${fmtDate(date)} déjà dans FitPulse` });

  await db.insert(weights).values({ profileId: p.id, date, weightKg, bodyFatPct });
  return json({
    ok: true,
    status: "created",
    weight: n.value,
    message: `✅ ⚖️ ${weightKg.toFixed(1).replace(".", ",")} kg (${fmtDate(date)}) ajouté à FitPulse`,
  });
}
