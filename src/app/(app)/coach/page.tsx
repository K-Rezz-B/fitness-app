import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { getProfile, getWeights, getWorkouts } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { coach, movingAverage, SOURCES } from "@/lib/coach";
import { GOALS } from "@/lib/constants";
import { addDays, fmtDate, today } from "@/lib/dates";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { WeightChart } from "@/components/charts";

export const metadata: Metadata = { title: "Coach" };

const ICON = {
  good: <CheckCircle2 size={18} className="shrink-0 text-good" />,
  info: <Info size={18} className="shrink-0 text-force" />,
  warning: <AlertTriangle size={18} className="shrink-0 text-warning" />,
};
const LEVEL_LABEL = { good: "Top", info: "Conseil", warning: "Attention" };

export default async function Coach() {
  const [p, ws, all] = await Promise.all([getProfile(), getWeights(), getWorkouts()]);
  const stats = computeStats(all, p?.weeklySessionsTarget ?? 3);
  const c = coach(p, ws, stats);
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
      <PageHeader title="Coach" subtitle={`Objectif : ${GOALS[p!.goal as keyof typeof GOALS] ?? p!.goal}`} action={<Link href="/profile" className="btn-ghost hidden md:inline-flex">Profil & pesées</Link>} />

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Poids" value={c.kg.toFixed(1)} unit="kg" sub={c.weeklyRate !== null ? `${c.weeklyRate > 0 ? "+" : ""}${c.weeklyRate.toFixed(2)} kg/sem` : "Tendance : 2 sem. de données"} />
        <Stat label="IMC" value={c.bmi.toFixed(1)} sub={`${c.bmiLabel} · zone ${c.healthyRange[0].toFixed(0)}-${c.healthyRange[1].toFixed(0)} kg`} />
        <Stat label="Métabolisme" value={c.bmr} unit="kcal" sub={`Dépense totale ≈ ${c.tdee} kcal`} />
        <Stat label="Objectif" value={c.target ?? "—"} unit={c.target ? "kg" : undefined} sub={c.eta ? `≈ ${c.eta} sem. à rythme sain` : "Définis un poids cible"} />
      </section>

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
              <div className="h-2 rounded-full bg-surface-2"><div className="h-full rounded-full bg-accent-2" style={{ width: `${Math.min(100, (m.kcal / c.calories) * 100)}%` }} /></div>
            </div>
          ))}
          <div className="mt-4 flex justify-between border-t border-line pt-3 text-sm">
            <span>💧 Eau</span>
            <span className="font-mono tabular-nums">{c.waterL} L/j</span>
          </div>
          <p className="mt-3 text-[11px] text-muted">Mifflin-St Jeor × facteur d&apos;activité, ajusté à l&apos;objectif. Estimation : ajuste selon ta tendance de poids sur 2-3 semaines.</p>
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
