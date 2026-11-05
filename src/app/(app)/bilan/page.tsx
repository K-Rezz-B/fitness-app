import type { Metadata } from "next";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { getActivity, getWeights, getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { buildRecap, type Period } from "@/lib/recap";
import { addDays, fmtDate } from "@/lib/dates";
import { PageHeader } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { ProgressLinks } from "@/components/progress-links";
import { ShareButton } from "@/components/share-button";

export const metadata: Metadata = { title: "Bilan" };

function Delta({ value }: { value: number | null }) {
  if (value === null) return null;
  const up = value >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 font-mono text-[11px] font-semibold", up ? "bg-good/15 text-good" : "bg-critical/15 text-critical")}>
      {up ? <TrendingUp size={11} /> : <TrendingDown size={11} />} {up ? "+" : ""}{value} %
    </span>
  );
}

export default async function Bilan({ searchParams }: PageProps<"/bilan">) {
  const me = await requireProfile();
  const sp = await searchParams;
  const period: Period = sp.p === "month" ? "month" : "week";
  const offset = Math.max(0, Math.min(120, Number(sp.o) || 0));
  const [all, ws, activity] = await Promise.all([getWorkouts(me.id), getWeights(me.id), getActivity(me.id, 75)]);
  const r = buildRecap(all, ws, activity, period, offset);

  const label =
    period === "week"
      ? `Semaine du ${fmtDate(r.from)} au ${fmtDate(addDays(r.to, -1))}`
      : new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${r.from}T00:00:00Z`));
  const vsPrev = period === "week"
    ? r.ongoing ? "aux mêmes jours de la semaine précédente" : "à la semaine précédente"
    : r.ongoing ? "aux mêmes jours du mois précédent" : "au mois précédent";
  const href = (o: number, p: Period = period) => `/bilan?p=${p}${o ? `&o=${o}` : ""}`;
  const h = Math.floor(r.cur.minutes / 60);
  const mn = r.cur.minutes % 60;

  const headline =
    r.cur.sessions === 0
      ? r.ongoing ? "La période vient de commencer : à toi de jouer 💪" : "Période calme. On repart de plus belle ? 🌱"
      : r.cur.sessions >= me.weeklySessionsTarget * (period === "week" ? 1 : 4)
        ? "Objectif atteint, tu es une machine 🔥"
        : r.deltas.minutes !== null && r.deltas.minutes > 0
          ? "Tu en fais plus qu'avant, bravo 📈"
          : "Chaque séance compte, continue 💪";

  const shareText = [
    `📊 Mon bilan FitPulse · ${label}`,
    `💪 ${r.cur.sessions} séance(s) · ⏱️ ${h ? `${h} h ` : ""}${mn} min`,
    r.cur.km > 0 && `🛣️ ${r.cur.km.toFixed(1)} km`,
    r.favType && `${r.favType.emoji} Favori : ${r.favType.label}`,
    r.records.length > 0 && `🏆 ${r.records.length} record(s) : ${r.records.slice(0, 3).map((x) => `${x.name} ${x.value}`).join(", ")}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <>
      <PageHeader title="Bilan" subtitle={label} />
      <ProgressLinks current="bilan" />

      <div className="mb-4 flex items-center gap-2">
        <div className="flex rounded-2xl border border-line bg-surface p-1">
          {(["week", "month"] as const).map((p) => (
            <Link key={p} href={href(0, p)} className={clsx("rounded-xl px-3 py-1.5 text-sm font-medium transition", period === p ? "bg-surface-2 text-ink" : "text-muted")}>
              {p === "week" ? "Semaine" : "Mois"}
            </Link>
          ))}
        </div>
        <div className="ml-auto flex gap-1">
          <Link href={href(offset + 1)} className="btn-ghost px-2.5" aria-label="Période précédente"><ChevronLeft size={18} /></Link>
          {offset > 0 && <Link href={href(offset - 1)} className="btn-ghost px-2.5" aria-label="Période suivante"><ChevronRight size={18} /></Link>}
        </div>
      </div>

      <section className="glow mb-4 rounded-3xl border border-line p-6 text-center">
        <div className="text-xs font-semibold tracking-widest text-muted uppercase">{r.ongoing ? "En cours" : "Bilan"}</div>
        <p className="animate-fade-up mt-1 text-lg font-bold">{headline}</p>
        <div className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4">
          <div>
            <div className="font-mono text-5xl font-bold tabular-nums"><CountUp value={r.cur.sessions} /></div>
            <div className="mt-1 text-xs text-muted">séance(s)</div>
            <div className="mt-1"><Delta value={r.deltas.sessions} /></div>
          </div>
          <div>
            <div className="font-mono text-5xl font-bold tabular-nums">{h > 0 ? <><CountUp value={h} /><span className="text-2xl">h</span></> : <><CountUp value={mn} /><span className="text-2xl">min</span></>}</div>
            <div className="mt-1 text-xs text-muted">{h > 0 ? `${mn} min · ` : ""}d&apos;entraînement</div>
            <div className="mt-1"><Delta value={r.deltas.minutes} /></div>
          </div>
          <div>
            <div className="font-mono text-5xl font-bold tabular-nums"><CountUp value={r.cur.activeDays} /><span className="text-2xl text-muted">/{r.span}</span></div>
            <div className="mt-1 text-xs text-muted">jours actifs</div>
          </div>
          <div>
            <div className="font-mono text-5xl font-bold tabular-nums"><CountUp value={r.cur.load} /></div>
            <div className="mt-1 text-xs text-muted">charge (UA)</div>
            <div className="mt-1"><Delta value={r.deltas.load} /></div>
          </div>
        </div>
        <p className="mt-4 text-[11px] text-muted">Pourcentages comparés {vsPrev}.</p>
      </section>

      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          r.favType && { k: "Séance favorite", v: `${r.favType.emoji} ${r.favType.label}`, s: `${r.favType.count} fois` },
          r.bestDay && { k: "Jour le plus actif", v: r.bestDay, s: "le plus de minutes" },
          r.longest && { k: "Plus longue séance", v: `${r.longest.emoji} ${r.longest.minutes} min`, s: r.longest.title },
          r.cur.km > 0 && { k: "Distance", v: `${r.cur.km.toFixed(1)} km`, s: "course, vélo, marche…" },
          r.stepsAvg !== null && { k: "Pas / jour", v: new Intl.NumberFormat("fr-FR").format(r.stepsAvg), s: `objectif ${new Intl.NumberFormat("fr-FR").format(me.stepsGoal)}` },
          r.weightChange !== null && { k: "Poids", v: `${r.weightChange > 0 ? "+" : ""}${r.weightChange.toFixed(1)} kg`, s: "sur la période" },
          r.cur.kcal > 0 && { k: "Calories (montre)", v: new Intl.NumberFormat("fr-FR").format(r.cur.kcal), s: "kcal brûlées en séance" },
        ]
          .filter((x): x is { k: string; v: string; s: string } => !!x)
          .map((x) => (
            <div key={x.k} className="card p-4">
              <div className="text-xs font-medium tracking-wide text-muted uppercase">{x.k}</div>
              <div className="mt-1.5 truncate text-lg font-bold">{x.v}</div>
              <div className="truncate text-xs text-ink-2">{x.s}</div>
            </div>
          ))}
      </section>

      {r.records.length > 0 && (
        <section className="card mb-4">
          <div className="mb-3 text-sm font-semibold">🏆 Records battus · {r.records.length}</div>
          <ul className="space-y-2">
            {r.records.map((x, i) => (
              <li key={`${x.name}-${x.date}`} className="animate-fade-up flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-sm" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="truncate font-medium">{x.name}</span>
                <span className="shrink-0 font-mono text-accent">{x.value}</span>
                <span className="w-14 shrink-0 text-right text-xs text-muted">{fmtDate(x.date)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="flex justify-center">
        <ShareButton title="Mon bilan FitPulse" text={shareText} />
      </div>
    </>
  );
}
