import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { getActivity, getWeights, getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { computeStats } from "@/lib/stats";
import { coach, movingAverage, SOURCES } from "@/lib/coach";
import { GOALS } from "@/lib/constants";
import { addDays, fmtDate, today } from "@/lib/dates";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { WeightChart } from "@/components/charts";
import { CountUp } from "@/components/count-up";

export const metadata: Metadata = { title: "Coach" };

const ICON = {
  good: <CheckCircle2 size={18} className="shrink-0 text-good" />,
  info: <Info size={18} className="shrink-0 text-force" />,
  warning: <AlertTriangle size={18} className="shrink-0 text-warning" />,
};
const LEVEL_LABEL = { good: "Top", info: "Conseil", warning: "Attention" };

/** Progression vers le poids cible depuis la première pesée, et date d'arrivée au rythme mesuré. */
function weightGoal(ws: { date: string; weightKg: number }[], kg: number, target: number | null | undefined, weeklyRate: number | null) {
  if (!target || !ws.length) return null;
  const start = [...ws].sort((a, b) => a.date.localeCompare(b.date))[0].weightKg;
  const total = target - start;
  const progress = Math.abs(total) < 0.1 ? 1 : Math.min(1, Math.max(0, (kg - start) / total));
  const left = Math.abs(target - kg);
  const towards = weeklyRate !== null && Math.abs(weeklyRate) >= 0.05 && Math.sign(weeklyRate) === Math.sign(target - kg);
  const trendDate = towards && left > 0.2 ? addDays(today(), Math.round((left / Math.abs(weeklyRate!)) * 7)) : null;
  return { start, target, progress, left, trendDate };
}

export default async function Coach() {
  const p = await requireProfile();
  const [ws, all, activity] = await Promise.all([getWeights(p.id), getWorkouts(p.id), getActivity(p.id, 15)]);
  const stats = computeStats(all, p.weeklySessionsTarget);
  const c = coach(p, ws, stats, activity);
  const goal = c.ready ? weightGoal(ws, c.kg, c.target, c.weeklyRate) : null;
  const chart = movingAverage(ws.filter((w) => w.date >= addDays(today(), -120))).map((d) => ({ ...d, label: fmtDate(d.date) }));

  if (!c.ready) {
    return (
      <>
        <PageHeader title="Coach" />
        <Empty emoji="🧠" title="Complète ton profil">
          Il me manque : {c.missing.join(", ")}. <Link href="/profile" className="text-accent">Compléter mon profil →</Link>
        </Empty>
      </>
    );
  }

  return (
    <>
      <PageHeader title="Coach" subtitle={`Objectif : ${GOALS[p.goal as keyof typeof GOALS] ?? p.goal}`} action={<Link href="/profile" className="btn-ghost hidden md:inline-flex">Profil & pesées</Link>} />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Poids" value={c.kg.toFixed(1)} unit="kg" sub={c.weeklyRate !== null ? `${c.weeklyRate > 0 ? "+" : ""}${c.weeklyRate.toFixed(2)} kg/sem` : "Tendance : 2 sem. de données"} />
        <Stat label="IMC" value={c.bmi.toFixed(1)} sub={`${c.bmiLabel} · zone ${c.healthyRange[0].toFixed(0)}-${c.healthyRange[1].toFixed(0)} kg`} />
        <Stat label="Métabolisme" value={c.bmr} unit="kcal" sub={`Dépense totale ≈ ${c.tdee} kcal${c.stepsAvg !== null ? ` · ${new Intl.NumberFormat("fr-FR").format(c.stepsAvg)} pas/j mesurés` : ""}`} />
        <Stat label="Objectif" value={c.target ?? "—"} unit={c.target ? "kg" : undefined} sub={c.eta ? `≈ ${c.eta} sem. à rythme sain` : "Définis un poids cible"} />
      </section>

      {goal && (
        <section className="card mb-4">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm font-semibold">🎯 Objectif de poids</span>
            <span className="font-mono text-xs text-ink-2 tabular-nums">
              {goal.start.toFixed(1)} kg → <b className="text-ink">{c.kg.toFixed(1)}</b> → {goal.target.toFixed(1)} kg
            </span>
          </div>
          <div className="relative h-3 overflow-hidden rounded-full bg-surface-2">
            <div className="animate-grow-x h-full rounded-full bg-gradient-to-r from-accent-2 to-accent" style={{ width: `${Math.round(goal.progress * 100)}%` }} />
          </div>
          <div className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums"><CountUp value={Math.round(goal.progress * 100)} /> %</div>
              <div className="text-xs text-muted">du chemin parcouru</div>
            </div>
            <div>
              <div className="font-mono text-2xl font-bold tabular-nums"><CountUp value={goal.left} decimals={1} /> kg</div>
              <div className="text-xs text-muted">encore à {goal.target > c.kg ? "prendre" : "perdre"}</div>
            </div>
            <div>
              <div className="text-base font-semibold">{goal.trendDate ? `≈ ${fmtDate(goal.trendDate, { year: "numeric" })}` : "—"}</div>
              <div className="text-xs text-muted">
                {goal.trendDate
                  ? `à ton rythme actuel (${c.weeklyRate! > 0 ? "+" : ""}${c.weeklyRate!.toFixed(2)} kg/sem)`
                  : c.weeklyRate === null
                    ? "date estimée après 2 sem. de pesées"
                    : "ta tendance ne va pas encore vers l'objectif"}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <section className="card lg:col-span-2">
          <div className="mb-1 text-sm font-semibold">🍽️ Nutrition quotidienne</div>
          <div className="mb-4 font-mono text-4xl font-bold tabular-nums">{c.calories}<span className="ml-1 text-base text-muted">kcal</span></div>
          {[
            { label: "Protéines", g: c.protein, kcal: c.protein * 4 },
            { label: "Lipides", g: c.fat, kcal: c.fat * 9 },
            { label: "Glucides", g: c.carbs, kcal: c.carbs * 4 },
          ].map((m) => (
            <div key={m.label} className="mb-3">
              <div className="mb-1 flex justify-between text-sm">
                <span>{m.label}</span>
                <span className="font-mono tabular-nums">{m.g} g <span className="text-muted">· {Math.round((m.kcal / c.calories) * 100)} %</span></span>
              </div>
              <div className="h-2 rounded-full bg-surface-2"><div className="animate-grow-x h-full rounded-full bg-accent-2" style={{ width: `${Math.min(100, (m.kcal / c.calories) * 100)}%` }} /></div>
            </div>
          ))}
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
            <span>💧 Eau</span>
            <span className="font-mono tabular-nums">{c.waterL} L/j</span>
          </div>
          <p className="mt-3 text-[11px] text-muted">Mifflin-St Jeor × facteur d&apos;activité ({c.activitySource === "pas" ? <>mesuré par tes pas Apple Santé : <b>{c.activityLabel}</b></> : <>déclaré dans ton profil : {c.activityLabel}</>}), ajusté à l&apos;objectif. Estimation : ajuste selon ta tendance de poids sur 2-3 semaines.</p>
        </section>

        <section className="card lg:col-span-3">
          <div className="mb-3 text-sm font-semibold">⚖️ Évolution du poids · 120 j</div>
          {chart.length >= 2 ? <WeightChart data={chart} target={c.target} /> : <p className="text-sm text-muted">Ajoute au moins 2 pesées dans <Link href="/profile" className="text-accent">ton profil</Link>.</p>}
        </section>
      </div>

      <section className="mb-4">
        <h2 className="mb-2 px-1 text-sm font-semibold text-ink-2">Recommandations personnalisées</h2>
        <div className="grid gap-2 md:grid-cols-2">
          {c.advice.map((a) => (
            <div key={a.title} className="card flex gap-3 p-4">
              {ICON[a.level]}
              <div>
                <div className="text-sm font-semibold">
                  <span className="sr-only">{LEVEL_LABEL[a.level]} : </span>
                  {a.title}
                </div>
                <p className="mt-0.5 text-sm text-ink-2">{a.body}</p>
                {a.source && <p className="mt-1 text-[11px] text-muted">Source : {a.source}</p>}
              </div>
            </div>
          ))}
        </div>
      </section>

      <details className="card text-xs text-muted">
        <summary className="cursor-pointer font-medium text-ink-2">📚 Méthodologie & sources</summary>
        <ul className="mt-2 list-disc space-y-1 pl-4">
          {Object.values(SOURCES).map((s) => <li key={s}>{s}</li>)}
          <li>Charge de séance sRPE : Foster et al., J Strength Cond Res 2001</li>
        </ul>
        <p className="mt-2">Ces conseils sont indicatifs et ne remplacent pas l&apos;avis d&apos;un médecin ou diététicien.</p>
      </details>
    </>
  );
}
