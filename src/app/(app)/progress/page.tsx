import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { Trophy, TrendingUp } from "lucide-react";
import { getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { exerciseIndex, formatSets } from "@/lib/records";
import { fmtDate } from "@/lib/dates";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { ExerciseChart } from "@/components/charts";
import { CountUp } from "@/components/count-up";
import { ProgressLinks } from "@/components/progress-links";

export const metadata: Metadata = { title: "Progrès" };

export default async function Progress({ searchParams }: PageProps<"/progress">) {
  const me = await requireProfile();
  const [all, sp] = await Promise.all([getWorkouts(me.id), searchParams]);
  const index = exerciseIndex(all);
  const wanted = typeof sp.ex === "string" ? sp.ex : undefined;
  const sel = index.find((e) => e.key === wanted) ?? index[0];

  if (!sel) {
    return (
      <>
        <PageHeader title="Progrès" back="/workouts" subtitle="Records et évolution par exercice" />
        <ProgressLinks current="progress" />
        <Empty emoji="🏋️" title="Pas encore d'exercices détaillés">
          Ajoute tes exercices (séries, reps, charges) quand tu enregistres une séance : tes records et ta progression apparaîtront ici.
        </Empty>
      </>
    );
  }

  const bodyweight = sel.best.maxWeight === 0;
  const first = sel.points[0];
  const gain = !bodyweight && first.e1rm > 0 ? Math.round(((sel.best.e1rm - first.e1rm) / first.e1rm) * 100) : null;
  const data = sel.points.map((p) => ({ label: fmtDate(p.date), e1rm: p.e1rm, maxWeight: p.maxWeight, maxReps: p.maxReps }));

  return (
    <>
      <PageHeader title="Progrès" back="/workouts" subtitle={`${index.length} exercice(s) suivis`} />
      <ProgressLinks current="progress" />

      <nav className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" aria-label="Exercices">
        {index.map((e) => (
          <Link
            key={e.key}
            href={`/progress?ex=${encodeURIComponent(e.key)}`}
            scroll={false}
            className={clsx("chip shrink-0 px-3 py-1.5 text-sm transition", e.key === sel.key && "border-accent bg-accent/10 text-accent")}
          >
            {e.name}
          </Link>
        ))}
      </nav>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {bodyweight ? (
          <Stat label="Record reps" value={<CountUp value={sel.best.maxReps} />} unit="reps" sub={`le ${fmtDate(sel.best.maxRepsDate)}`} />
        ) : (
          <>
            <Stat label="Charge max" value={<CountUp value={sel.best.maxWeight} decimals={sel.best.maxWeight % 1 ? 1 : 0} />} unit="kg" sub={`🏆 le ${fmtDate(sel.best.maxWeightDate)}`} />
            <Stat label="1RM estimé" value={<CountUp value={sel.best.e1rm} decimals={1} />} unit="kg" sub={`le ${fmtDate(sel.best.e1rmDate)}`} />
          </>
        )}
        <Stat label="Séances" value={<CountUp value={sel.points.length} />} sub={`depuis le ${fmtDate(first.date)}`} />
        {gain !== null ? (
          <Stat label="Progression" value={`${gain >= 0 ? "+" : ""}${gain}`} unit="%" sub={<span className="inline-flex items-center gap-1"><TrendingUp size={12} /> 1RM depuis le début</span>} />
        ) : (
          <Stat label="Dernière fois" value={fmtDate(sel.last.date)} sub={formatSets(sel.last.sets)} />
        )}
      </section>

      <section className="card mb-4">
        <div className="mb-3 text-sm font-semibold">📈 {sel.name}</div>
        {sel.points.length >= 2 ? (
          <ExerciseChart data={data} bodyweight={bodyweight} />
        ) : (
          <p className="text-sm text-muted">Fais cet exercice au moins 2 fois pour voir ta courbe. Dernière fois : {formatSets(sel.last.sets)}.</p>
        )}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Trophy size={16} className="text-warning" /> Tous mes records
        </div>
        <ul className="divide-y divide-line">
          {index.map((e, i) => (
            <li key={e.key} className="animate-fade-up" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <Link href={`/progress?ex=${encodeURIComponent(e.key)}`} scroll={false} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate font-medium">{e.name}</span>
                <span className="shrink-0 font-mono text-xs text-ink-2 tabular-nums">
                  {e.best.maxWeight > 0 ? `${e.best.maxWeight} kg · 1RM ${e.best.e1rm}` : `${e.best.maxReps} reps`}
                </span>
                <span className="w-16 shrink-0 text-right text-xs text-muted">{fmtDate(e.best.maxWeight > 0 ? e.best.maxWeightDate : e.best.maxRepsDate)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
