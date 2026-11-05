import { sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { dailyActivity } from "@/lib/schema";
import { fail, json, profileFromRequest, readJson, unauthorized } from "@/lib/api-auth";
import { normalizeActivity, type ImportedActivity } from "@/lib/ingest";
import { fmtDate } from "@/lib/dates";

export const dynamic = "force-dynamic";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const summary = (a: ImportedActivity) =>
  [
    a.steps !== null && `${nf.format(a.steps)} pas`,
    a.activeKcal !== null && `${nf.format(a.activeKcal)} kcal`,
    a.distanceKm !== null && `${nf.format(a.distanceKm)} km`,
    a.exerciseMin !== null && `${a.exerciseMin} min d'exercice`,
  ]
    .filter(Boolean)
    .join(" · ");

/**
 * Activité quotidienne depuis Raccourcis (Apple Santé / app Forme).
 * { date?, steps, activeKcal, distanceKm, exerciseMin?, standHours? } — ou un tableau (rattrapage, 62 jours max).
 * Renvoyer le même jour met à jour les totaux (les champs absents sont conservés).
 */
export async function POST(req: Request) {
  const p = await profileFromRequest(req);
  if (!p) return unauthorized();
  const body = await readJson(req);
  if (!body || typeof body !== "object") return fail(400, "corps JSON attendu");
  const items = (Array.isArray(body) ? body : [body]).filter((x): x is Record<string, unknown> => !!x && typeof x === "object").slice(0, 62);
  const now = new Date();
  const saved: ImportedActivity[] = [];
  const errors: string[] = [];
  for (const it of items) {
    const n = normalizeActivity(it, now);
    if (!n.ok) {
      errors.push(n.error);
      continue;
    }
    await db
      .insert(dailyActivity)
      .values({ profileId: p.id, ...n.value, updatedAt: now })
      .onConflictDoUpdate({
        target: [dailyActivity.profileId, dailyActivity.date],
        set: {
          steps: sql`coalesce(excluded.steps, ${dailyActivity.steps})`,
          activeKcal: sql`coalesce(excluded.active_kcal, ${dailyActivity.activeKcal})`,
          distanceKm: sql`coalesce(excluded.distance_km, ${dailyActivity.distanceKm})`,
          exerciseMin: sql`coalesce(excluded.exercise_min, ${dailyActivity.exerciseMin})`,
          standHours: sql`coalesce(excluded.stand_hours, ${dailyActivity.standHours})`,
          updatedAt: now,
        },
      });
    saved.push(n.value);
  }
  if (!Array.isArray(body)) {
    if (!saved.length) return fail(422, errors[0] ?? "données invalides");
    return json({ ok: true, activity: saved[0], message: `✅ Forme du ${fmtDate(saved[0].date)} : ${summary(saved[0])}` });
  }
  return json({ ok: errors.length === 0, saved: saved.length, errors, message: `✅ FitPulse : ${saved.length} jour(s) d'activité importé(s)${errors.length ? `, ${errors.length} erreur(s)` : ""}` });
}
