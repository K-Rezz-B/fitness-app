import { after } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { profile, weights, workouts, type Profile } from "@/lib/schema";
import { fail, json, profileFromRequest, readJson, unauthorized } from "@/lib/api-auth";
import { mapWorkoutType, normalizeWorkout, parseDate, type ImportedWorkout } from "@/lib/ingest";
import { notifyNewBadges } from "@/lib/push";
import { ageFrom } from "@/lib/dates";
import { TZ, typeInfo } from "@/lib/constants";

export const dynamic = "force-dynamic";

type Body = Record<string, unknown>;
const MAX_PENDING_MS = 6 * 60 * 60_000; // un exercice « commencé » expire après 6 h

/**
 * Import de séances depuis Raccourcis (Apple Santé / Apple Watch).
 * - Séance complète : { type, start, end | durationMin, distance?, calories?, heartRateAvg? } (ou un tableau)
 * - Signal : { event: "start" | "end", type? } → la durée est calculée entre les deux signaux
 */
export async function POST(req: Request) {
  const p = await profileFromRequest(req);
  if (!p) return unauthorized();
  const body = await readJson(req);
  if (!body || typeof body !== "object") return fail(400, "corps JSON attendu");
  if (!Array.isArray(body) && (body as Body).event) return handleEvent(p, body as Body);

  const items = (Array.isArray(body) ? body : [body]).filter((x): x is Body => !!x && typeof x === "object").slice(0, 50);
  if (!items.length) return fail(400, "aucune séance dans la requête");
  const ctx = await context(p);
  const results = [];
  for (const it of items) {
    const n = normalizeWorkout(it, ctx);
    results.push(n.ok ? await insert(p, n.value) : { status: "error" as const, error: n.error });
  }
  return respond(p, results, Array.isArray(body));
}

async function context(p: Profile) {
  const [w] = await db
    .select({ kg: weights.weightKg })
    .from(weights)
    .where(eq(weights.profileId, p.id))
    .orderBy(desc(weights.date), desc(weights.id))
    .limit(1);
  return { age: ageFrom(p.birthDate), kg: w?.kg ?? null, now: new Date() };
}

async function insert(p: Profile, v: ImportedWorkout) {
  const [row] = await db
    .insert(workouts)
    .values({ ...v, profileId: p.id, source: "apple-health", exercises: [] })
    .onConflictDoNothing({ target: [workouts.profileId, workouts.externalId] })
    .returning({ id: workouts.id });
  return row
    ? { status: "created" as const, id: row.id, title: v.title, type: v.type, durationMin: v.durationMin, xp: 50 + Math.round((v.durationMin * v.rpe) / 5) }
    : { status: "duplicate" as const, title: v.title, durationMin: v.durationMin };
}

type Res = Awaited<ReturnType<typeof insert>> | { status: "error"; error: string };

function respond(p: Profile, results: Res[], batch: boolean) {
  const created = results.filter((r) => r.status === "created");
  const last = created[created.length - 1];
  if (last) after(() => notifyNewBadges(p, last.id));

  if (!batch) {
    const r = results[0];
    if (r.status === "error") return fail(422, r.error);
    const emoji = typeInfo(r.status === "created" ? r.type : "cardio").emoji;
    return json({
      ok: true,
      status: r.status,
      workout: r,
      message:
        r.status === "created"
          ? `✅ ${emoji} ${r.title} · ${r.durationMin} min ajoutée à FitPulse (+${r.xp} XP)`
          : `ℹ️ ${r.title} était déjà dans FitPulse`,
    });
  }
  const dup = results.filter((r) => r.status === "duplicate").length;
  const errors = results.flatMap((r) => (r.status === "error" ? [r.error] : []));
  return json({
    ok: errors.length === 0,
    created: created.length,
    duplicates: dup,
    errors,
    message: `✅ FitPulse : ${created.length} séance(s) importée(s)${dup ? `, ${dup} déjà présente(s)` : ""}${errors.length ? `, ${errors.length} erreur(s)` : ""}`,
  });
}

async function handleEvent(p: Profile, b: Body) {
  const ev = String(b.event).toLowerCase();
  const at = parseDate(b.date) ?? new Date();
  if (ev === "start" || ev === "debut" || ev === "début") {
    const type = b.type ? mapWorkoutType(b.type) : null;
    await db.update(profile).set({ pendingWorkoutStart: at, pendingWorkoutType: type }).where(eq(profile.id, p.id));
    return json({ ok: true, status: "started", message: `⏱️ FitPulse : début de séance noté (${at.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: TZ })})` });
  }
  if (ev !== "end" && ev !== "fin") return fail(400, `event inconnu « ${ev} » (start ou end)`);

  const start = p.pendingWorkoutStart;
  if (!start || at.getTime() - start.getTime() > MAX_PENDING_MS || at.getTime() < start.getTime())
    return fail(409, "aucun début d'exercice récent : ajoute l'automatisation « Commence » (voir page Apple)");
  const n = normalizeWorkout({ ...b, type: b.type ?? p.pendingWorkoutType ?? undefined, start: start.toISOString(), end: at.toISOString() }, await context(p));
  if (!n.ok) return fail(422, n.error);
  await db.update(profile).set({ pendingWorkoutStart: null, pendingWorkoutType: null }).where(eq(profile.id, p.id));
  return respond(p, [await insert(p, n.value)], false);
}
