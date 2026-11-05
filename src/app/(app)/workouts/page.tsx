import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { CATEGORIES, typeInfo } from "@/lib/constants";
import { dayKey, fmtDate, fmtTime, weekStart } from "@/lib/dates";
import { Empty, PageHeader } from "@/components/ui";
import { ProgressLinks } from "@/components/progress-links";

export const metadata: Metadata = { title: "Séances" };

export default async function Workouts() {
  const all = await getWorkouts((await requireProfile()).id);
  const groups = new Map<string, typeof all>();
  for (const w of all) {
    const k = weekStart(dayKey(w.date));
    groups.set(k, [...(groups.get(k) ?? []), w]);
  }
  return (
    <>
      <PageHeader
        title="Séances"
        subtitle={`${all.length} séance(s) au compteur`}
        action={<Link href="/workouts/new" className="btn-primary hidden md:inline-flex"><Plus size={16} /> Ajouter</Link>}
      />
      {all.length > 0 && <ProgressLinks />}
      {all.length === 0 ? (
        <Empty emoji="🏁" title="Aucune séance pour l'instant">
          Lance-toi : <Link href="/workouts/new" className="text-accent">enregistre ta première séance</Link> et débloque ton premier badge.
        </Empty>
      ) : (
        <div className="space-y-6">
          {[...groups].map(([week, list]) => (
            <section key={week}>
              <div className="mb-2 flex items-baseline justify-between px-1">
                <h2 className="text-sm font-semibold text-ink-2">Semaine du {fmtDate(week)}</h2>
                <span className="font-mono text-xs text-muted">
                  {list.length} séance(s) · {list.reduce((s, w) => s + w.durationMin, 0)} min
                </span>
              </div>
              <ul className="space-y-2">
                {list.map((w) => {
                  const info = typeInfo(w.type);
                  return (
                    <li key={w.id}>
                      <Link href={`/workouts/${w.id}`} className="card flex items-center gap-4 p-4 transition hover:border-muted">
                        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-2xl" style={{ boxShadow: `inset 0 -3px 0 ${CATEGORIES[info.category].color}` }}>
                          {info.emoji}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold">{w.title}</div>
                          <div className="text-xs text-muted">
                            {fmtDate(w.date, { weekday: "short" })} · {fmtTime(w.date)} · {info.label}
                            {w.exercises.length > 0 && ` · ${w.exercises.length} exos`}
                          </div>
                        </div>
                        <div className="text-right font-mono text-sm tabular-nums">
                          <div>{w.durationMin}′</div>
                          <div className="text-xs text-muted">{w.distanceKm ? `${w.distanceKm} km` : `RPE ${w.rpe}`}</div>
                        </div>
                        <ChevronRight size={16} className="text-muted" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
