import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Activity, Dumbbell, Scale, Trophy } from "lucide-react";
import { getActivitySince, getWeights, getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { buildEvolution, parsePeriod, PERIODS, resolveRange, TIME_BANDS, type PeriodKey } from "@/lib/evolution";
import { CATEGORIES, WEEKDAYS } from "@/lib/constants";
import { fmtDate, today } from "@/lib/dates";
import { Empty, PageHeader, Stat } from "@/components/ui";
import { Heatmap } from "@/components/viz";
import { WeeklyChart, WeightChart } from "@/components/charts";
import { BarSeries, ExerciseProgress, LineSeries } from "@/components/evolution-charts";
import { ChartCard, Delta, fmtMinutes, Headline, TypeBars, WhenGrid } from "@/components/evolution-viz";
import { ProgressLinks } from "@/components/progress-links";

export const metadata: Metadata = { title: "Mon évolution" };

// Une couleur par mesure, la même partout dans l'app : accent = régularité / pas,
// orange = énergie & cardio, bleu = force, violet = intensité.
const LIME = "#c6f432";
const VIOLET = "#9d7bff";
const ORANGE = CATEGORIES.cardio.color;
const BLUE = CATEGORIES.force.color;

const nf = (v: number, decimals = 0) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(v);

function SectionTitle({ icon, children, sub }: { icon: ReactNode; children: ReactNode; sub?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex flex-wrap items-baseline gap-x-2 px-1">
      <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">{icon} {children}</h2>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

function Hint({ children }: { children: ReactNode }) {
  return <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">{children}</p>;
}

export default async function Evolution({ searchParams }: PageProps<"/evolution">) {
  const [p, sp] = await Promise.all([requireProfile(), searchParams]);
  const period = parsePeriod(sp.periode);
  const t = today();
  // L'activité quotidienne n'est lue que sur la période et la précédente (tout l'historique pour « Tout »)
  const activitySince = resolveRange(period, t, null).prev?.from ?? null;
  const [workouts, weights, activity] = await Promise.all([getWorkouts(p.id), getWeights(p.id), getActivitySince(p.id, activitySince)]);

  if (workouts.length === 0 && weights.length === 0 && activity.length === 0) {
    return (
      <>
        <PageHeader title="Mon évolution" />
        <ProgressLinks current="evolution" />
        <Empty emoji="📈" title="Pas encore de données">
          Enregistre une <Link href="/workouts/new" className="text-accent">séance</Link>, une{" "}
          <Link href="/profile" className="text-accent">pesée</Link> ou connecte{" "}
          <Link href="/integrations" className="text-accent">Apple Santé</Link> : tes courbes apparaîtront ici.
        </Empty>
      </>
    );
  }

  const ev = buildEvolution({
    workouts,
    weights,
    activity,
    profile: { weeklySessionsTarget: p.weeklySessionsTarget, stepsGoal: p.stepsGoal, moveGoalKcal: p.moveGoalKcal, goal: p.goal },
    period,
    today: t,
  });
  const { range, totals: T, prevTotals: P, activitySummary: A } = ev;
  const target = p.weeklySessionsTarget;
  const monthly = range.grain === "month";
  const unitLabel = monthly ? "Mois" : "Semaine";
  const perWeek = monthly ? "moyenne par semaine, mois par mois" : "semaine par semaine";
  const noPrev = (
    <span className="text-muted">{period === "tout" ? `depuis le ${fmtDate(range.from, { year: "numeric" })}` : "pas d'historique avant pour comparer"}</span>
  );
  const year = (k: string) => fmtDate(k, { year: "numeric" });
  const weightGoodWhenUp = p.goal === "lose" ? false : p.goal === "gain" ? true : null;

  // --- Séries pour les graphiques ---
  const sessions = ev.training.map((x) => ({
    label: x.label,
    title: x.title,
    value: x.sessions,
    note: `${x.minutes} min${monthly ? "/sem." : ""}${x.rpe !== null ? ` · RPE moyen ${nf(x.rpe, 1)}` : ""}`,
  }));
  const weeksOk = ev.training.filter((x) => x.sessions >= target).length;
  const loadData = ev.training.map((x) => ({ label: x.label, title: x.title, value: x.load, note: x.rpe !== null ? `RPE moyen ${nf(x.rpe, 1)}` : "aucune séance" }));
  const distance = ev.training.map((x) => ({ label: x.label, title: x.title, value: x.distanceKm }));
  const kcal = ev.training.map((x) => ({ label: x.label, title: x.title, value: x.kcal }));
  const tonnage = ev.training.map((x) => ({ label: x.label, title: x.title, value: x.tonnage }));
  const score = ev.score.map((x) => ({ label: x.label, title: x.title, value: x.score }));
  const acwrPoints = ev.score.filter((x) => x.acwr !== null);
  const acwr = ev.score.map((x) => ({ label: x.label, title: x.title, value: x.acwr, note: `Charge 7 j : ${x.acute} UA` }));
  const acwrMax = Math.max(2, ...acwrPoints.map((x) => Math.ceil(x.acwr! * 10) / 10));
  const scoreNow = ev.score.at(-1)?.score ?? null;
  const scoreStart = ev.score[0]?.score ?? null;
  const act = (f: (x: (typeof ev.activity)[number]) => number | null) => ev.activity.map((x) => ({ label: x.label, title: x.title, value: f(x) }));
  const favorite = ev.when
    .flatMap((row, i) => row.map((n, j) => ({ n, day: WEEKDAYS[i], band: TIME_BANDS[j].label })))
    .sort((a, b) => b.n - a.n)[0];
  const calWeeks = ev.calendar.length / 7;

  return (
    <>
      <PageHeader title="Mon évolution" subtitle={`Toutes tes données, du ${year(range.from)} au ${year(range.to)}`} />
      <ProgressLinks current="evolution" />

      {/* Filtre unique : il s'applique à tout ce qui suit */}
      <nav aria-label="Période" className="mb-5 flex gap-1 overflow-x-auto rounded-2xl border border-line bg-surface p-1">
        {(Object.keys(PERIODS) as PeriodKey[]).map((k) => (
          <Link
            key={k}
            href={k === "3m" ? "/evolution" : `/evolution?periode=${k}`}
            scroll={false}
            aria-current={k === period ? "page" : undefined}
            className={clsx(
              "flex-1 rounded-xl px-3 py-2 text-center text-sm font-medium whitespace-nowrap transition",
              k === period ? "bg-accent text-black" : "text-muted hover:bg-surface-2 hover:text-ink",
            )}
          >
            {PERIODS[k].label}
          </Link>
        ))}
      </nav>

      {/* Chiffres clés */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat label="Séances" value={T.sessions} sub={P ? <Delta cur={T.sessions} prev={P.sessions} /> : noPrev} />
        <Stat label="Temps actif" value={nf(T.minutes / 60, 1)} unit="h" sub={P ? <Delta cur={T.minutes / 60} prev={P.minutes / 60} unit=" h" decimals={1} /> : noPrev} />
        <Stat label="Distance" value={nf(T.distanceKm, 1)} unit="km" sub={P ? <Delta cur={T.distanceKm} prev={P.distanceKm} unit=" km" decimals={1} /> : noPrev} />
        <Stat label="Calories (séances)" value={nf(T.kcal)} unit="kcal" sub={P ? <Delta cur={T.kcal} prev={P.kcal} /> : noPrev} />
        <Stat
          label="Poids"
          value={ev.latestWeight ? nf(ev.latestWeight.kg, 1) : "—"}
          unit={ev.latestWeight ? "kg" : undefined}
          sub={
            ev.weightChange !== null ? (
              <Delta cur={ev.weightChange} prev={0} goodWhenUp={weightGoodWhenUp} unit=" kg" decimals={1} suffix="sur la période (moy. 7 j)" />
            ) : ev.latestWeight ? (
              `Dernière pesée le ${fmtDate(ev.latestWeight.date)}`
            ) : (
              <Link href="/profile" className="text-accent">Ajouter une pesée</Link>
            )
          }
        />
        <Stat
          label="Pas / jour"
          value={A.stepsAvg !== null ? nf(A.stepsAvg) : "—"}
          sub={A.stepsAvg !== null ? (A.prevStepsAvg !== null ? <Delta cur={A.stepsAvg} prev={A.prevStepsAvg} /> : `${A.stepDays} jour${A.stepDays > 1 ? "s" : ""} mesuré${A.stepDays > 1 ? "s" : ""}`) : <Link href="/integrations" className="text-accent">Connecter l&apos;app Forme</Link>}
        />
      </section>

      {/* ---------------- Entraînement ---------------- */}
      <SectionTitle icon={<Dumbbell size={18} className="text-accent" />} sub={`${T.sessions} séance${T.sessions > 1 ? "s" : ""} · ${fmtMinutes(T.minutes)}`}>
        Entraînement
      </SectionTitle>
      {T.sessions === 0 ? (
        <Empty emoji="🏁" title="Aucune séance sur cette période">
          <Link href="/workouts/new" className="text-accent">Enregistre une séance</Link> ou choisis une période plus longue.
        </Empty>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard
            title="Score de forme"
            subtitle={`Recalculé en fin de chaque semaine (objectif actuel : ${target} séances/sem.)`}
            aside={<Headline value={scoreNow ?? "—"} unit="/ 100" sub={<Delta cur={scoreNow} prev={scoreStart} suffix="sur la période" />} />}
            table={{ head: ["Date", "Score", "Ratio de charge"], rows: ev.score.map((x) => [x.title === "Aujourd'hui" ? "Aujourd'hui" : x.label, x.score, x.acwr ?? "—"]) }}
          >
            <LineSeries data={score} name="Score" color={LIME} domain={[0, 100]} area />
          </ChartCard>

          <ChartCard
            title="Séances par semaine"
            subtitle={monthly ? "Moyenne par semaine, mois par mois" : "Les barres pleines atteignent ton objectif"}
            aside={<Headline value={`${weeksOk}/${ev.training.length}`} sub={`${monthly ? "mois" : "semaines"} à l'objectif`} />}
          >
            <BarSeries data={sessions} name="Séances / sem." color={LIME} decimals={1} goal={target} goalLabel={`Objectif ${target}/sem.`} />
          </ChartCard>

          <ChartCard
            className="lg:col-span-2"
            title="Minutes d'entraînement par catégorie"
            subtitle={`${monthly ? "Moyenne par semaine, mois par mois" : "Semaine par semaine"} · repère : 150 min/sem. recommandées par l'OMS`}
            table={{
              head: [unitLabel, "Séances", "Minutes", "Force", "Cardio", "Mobilité", "Charge (UA)", "RPE moy.", "Distance (km)", "Calories", "Tonnage (kg)"],
              rows: ev.training.map((x) => [x.label, x.sessions, x.minutes, x.force, x.cardio, x.mobilite, x.load, x.rpe ?? "—", x.distanceKm, x.kcal, x.tonnage]),
            }}
          >
            <WeeklyChart data={ev.training} average={monthly} />
          </ChartCard>

          <ChartCard title="Charge d'entraînement" subtitle={`Durée × effort perçu (RPE, méthode sRPE), ${perWeek}`}>
            <BarSeries data={loadData} name="Charge" color={VIOLET} unit="UA" />
          </ChartCard>

          <ChartCard
            title="Ratio de charge aiguë / chronique"
            subtitle="Charge des 7 derniers jours ÷ moyenne hebdo des 28 derniers (Gabbett 2016)"
            aside={acwrPoints.length ? <Headline value={nf(acwrPoints.at(-1)!.acwr!, 2)} sub="actuel" /> : undefined}
          >
            {acwrPoints.length >= 2 ? (
              <LineSeries
                data={acwr}
                name="Ratio"
                color={VIOLET}
                decimals={2}
                domain={[0, acwrMax]}
                band={{ from: 0.8, to: 1.3, label: "Zone optimale 0,8 – 1,3" }}
                refs={[{ y: 1.5, label: "Au-delà de 1,5 : risque de blessure" }]}
              />
            ) : (
              <Hint>Il faut quelques semaines d&apos;entraînement pour calculer ce ratio.</Hint>
            )}
          </ChartCard>

          <ChartCard
            title="Répartition par activité"
            subtitle="Temps passé sur la période"
            table={{ head: ["Activité", "Catégorie", "Minutes", "Séances"], rows: ev.types.map((x) => [`${x.emoji} ${x.label}`, CATEGORIES[x.category].label, x.minutes, x.sessions]) }}
          >
            <TypeBars types={ev.types} />
          </ChartCard>

          <ChartCard
            title="Quand tu t'entraînes"
            subtitle={favorite && favorite.n > 0 ? `Créneau favori : ${favorite.day.toLowerCase()} ${favorite.band.toLowerCase()} (${favorite.n} séance${favorite.n > 1 ? "s" : ""})` : undefined}
            table={{ head: ["Jour", ...TIME_BANDS.map((b) => b.label)], rows: ev.when.map((row, i) => [WEEKDAYS[i], ...row]) }}
          >
            <WhenGrid grid={ev.when} />
          </ChartCard>

          <ChartCard title="Distance parcourue" subtitle={`Course, vélo, natation, marche… ${perWeek}`} aside={<Headline value={nf(T.distanceKm, 1)} unit="km" sub="au total" />}>
            {T.distanceKm > 0 ? (
              <BarSeries data={distance} name="Distance" color={ORANGE} unit="km" decimals={1} />
            ) : (
              <Hint>Aucune distance enregistrée sur la période (renseigne-la pour la course, le vélo, la natation ou la marche).</Hint>
            )}
          </ChartCard>

          <ChartCard
            title="Calories dépensées en séance"
            subtitle={`${perWeek[0].toUpperCase()}${perWeek.slice(1)} · mesurées par la montre${ev.kcalEstimated ? `, sinon estimées (MET × poids) : ${ev.kcalEstimated} séance${ev.kcalEstimated > 1 ? "s" : ""}` : ""}`}
            aside={<Headline value={nf(T.kcal)} unit="kcal" sub="au total" />}
          >
            {T.kcal > 0 ? (
              <BarSeries data={kcal} name="Calories" color={ORANGE} unit="kcal" />
            ) : (
              <Hint>Ajoute une <Link href="/profile" className="text-accent">pesée</Link> pour estimer les calories de tes séances.</Hint>
            )}
          </ChartCard>

          <ChartCard
            className="lg:col-span-2"
            title={`Calendrier · ${calWeeks} semaine${calWeeks > 1 ? "s" : ""}`}
            subtitle={range.period === "tout" && calWeeks >= 52 ? "Les 12 derniers mois" : "Minutes d'entraînement par jour"}
          >
            <Heatmap days={ev.calendar} todayKey={t} />
          </ChartCard>
        </div>
      )}

      {/* ---------------- Musculation ---------------- */}
      <SectionTitle icon={<Trophy size={18} className="text-force" />} sub="à partir des séries (reps × kg) notées dans tes séances">
        Musculation
      </SectionTitle>
      {ev.exercises.length === 0 ? (
        <Hint>
          Aucune série notée sur la période. Dans une séance, ajoute tes exercices avec reps et charges : tu verras ici ta
          progression exercice par exercice et le volume soulevé.
        </Hint>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Progression par exercice" subtitle="1RM estimé (formule d'Epley) pour les exercices avec charge, meilleure série sinon">
            <ExerciseProgress series={ev.exercises} color={BLUE} />
          </ChartCard>
          <ChartCard title="Volume soulevé" subtitle={`Tonnage = reps × charge, ${perWeek}`} aside={<Headline value={nf(T.tonnage / 1000, 1)} unit="t" sub="au total" />}>
            {T.tonnage > 0 ? (
              <BarSeries data={tonnage} name="Tonnage" color={BLUE} unit="kg" />
            ) : (
              <Hint>Exercices au poids du corps uniquement : pas de charge à additionner.</Hint>
            )}
          </ChartCard>
        </div>
      )}

      {/* ---------------- Corps ---------------- */}
      <SectionTitle icon={<Scale size={18} className="text-accent-2" />} sub={`${ev.weights.length} pesée${ev.weights.length > 1 ? "s" : ""} sur la période`}>
        Corps
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="Poids"
          subtitle="Pesées et moyenne glissante sur 7 jours"
          aside={ev.latestWeight ? <Headline value={nf(ev.latestWeight.kg, 1)} unit="kg" sub={p.targetWeightKg ? `objectif ${nf(p.targetWeightKg, 1)} kg` : undefined} /> : undefined}
          table={{ head: ["Date", "Poids (kg)", "Moyenne 7 j"], rows: ev.weights.map((x) => [x.label, x.weight, Math.round(x.avg * 10) / 10]) }}
        >
          {ev.weights.length >= 2 ? (
            <WeightChart data={ev.weights} target={p.targetWeightKg} />
          ) : (
            <Hint>Il faut au moins 2 pesées sur la période. <Link href="/profile" className="text-accent">Ajouter une pesée →</Link></Hint>
          )}
        </ChartCard>
        <ChartCard
          title="Masse grasse"
          subtitle="Saisie avec tes pesées (balance impédancemètre)"
          aside={ev.bodyFat.length ? <Headline value={nf(ev.bodyFat.at(-1)!.value, 1)} unit="%" sub={ev.bodyFat.length >= 2 ? <Delta cur={ev.bodyFat.at(-1)!.value} prev={ev.bodyFat[0].value} goodWhenUp={false} unit=" pt" decimals={1} suffix="sur la période" /> : undefined} /> : undefined}
          table={{ head: ["Date", "Masse grasse (%)", "Détail"], rows: ev.bodyFat.map((x) => [x.label, x.value, x.note]) }}
        >
          {ev.bodyFat.length >= 2 ? (
            <LineSeries data={ev.bodyFat} name="Masse grasse" color={VIOLET} unit="%" decimals={1} />
          ) : (
            <Hint>Renseigne ton % de masse grasse lors de tes <Link href="/profile" className="text-accent">pesées</Link> pour suivre ta composition corporelle.</Hint>
          )}
        </ChartCard>
      </div>

      {/* ---------------- Activité quotidienne ---------------- */}
      <SectionTitle icon={<Activity size={18} className="text-cardio" />} sub={`app Forme · ${A.days} jour${A.days > 1 ? "s" : ""} de données${range.activityGrain === "day" ? "" : " · moyenne par jour"}`}>
        Activité quotidienne
      </SectionTitle>
      {A.days === 0 ? (
        <Hint>
          Aucune donnée d&apos;activité sur la période. <Link href="/integrations" className="text-accent">Connecte l&apos;app Forme via Raccourcis</Link> pour
          suivre tes pas, ton énergie active et tes minutes d&apos;exercice.
        </Hint>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {A.has.steps && (
            <ChartCard
              title="Pas"
              subtitle={range.activityGrain === "day" ? "Jour par jour" : "Moyenne par jour"}
              aside={<Headline value={`${A.stepsGoalDays}/${A.stepDays}`} sub="jours à l'objectif" />}
              table={{
                head: [range.activityGrain === "day" ? "Jour" : unitLabel, "Pas", "Énergie (kcal)", "Exercice (min)", "Debout (h)", "Distance (km)"],
                rows: ev.activity
                  .filter((x) => [x.steps, x.activeKcal, x.exerciseMin, x.standHours, x.distanceKm].some((v) => v !== null))
                  .map((x) => [x.label, x.steps ?? "—", x.activeKcal ?? "—", x.exerciseMin ?? "—", x.standHours ?? "—", x.distanceKm ?? "—"]),
              }}
            >
              <BarSeries data={act((x) => x.steps)} name="Pas" color={LIME} goal={p.stepsGoal} goalLabel={`Objectif ${nf(p.stepsGoal)} pas`} />
            </ChartCard>
          )}
          {A.has.activeKcal && (
            <ChartCard title="Énergie active (Bouger)" subtitle={range.activityGrain === "day" ? "Jour par jour" : "Moyenne par jour"} aside={<Headline value={`${A.moveGoalDays}/${A.moveDays}`} sub="jours à l'objectif" />}>
              <BarSeries data={act((x) => x.activeKcal)} name="Énergie active" color={ORANGE} unit="kcal" goal={p.moveGoalKcal} goalLabel={`Objectif ${p.moveGoalKcal} kcal`} />
            </ChartCard>
          )}
          {A.has.exerciseMin && (
            <ChartCard title="Minutes d'exercice" subtitle="Mesurées par l'iPhone / la montre">
              <BarSeries data={act((x) => x.exerciseMin)} name="Exercice" color={VIOLET} unit="min" goal={30} goalLabel="Objectif Apple 30 min" />
            </ChartCard>
          )}
          {A.has.standHours && (
            <ChartCard title="Heures debout">
              <BarSeries data={act((x) => x.standHours)} name="Debout" color={VIOLET} unit="h" decimals={1} goal={12} goalLabel="Objectif Apple 12 h" />
            </ChartCard>
          )}
          {A.has.distanceKm && (
            <ChartCard title="Distance marchée / courue" subtitle="Toute la journée, séances comprises">
              <BarSeries data={act((x) => x.distanceKm)} name="Distance" color={ORANGE} unit="km" decimals={1} />
            </ChartCard>
          )}
        </div>
      )}

      {/* ---------------- Records ---------------- */}
      {ev.records.length > 0 && (
        <>
          <SectionTitle icon={<Trophy size={18} className="text-warning" />} sub={PERIODS[period].label.toLowerCase()}>
            Meilleures perfs de la période
          </SectionTitle>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {ev.records.map((r) => (
              <li key={r.label} className="card flex items-start gap-3 p-4">
                <span className="text-2xl" aria-hidden>{r.emoji}</span>
                <div className="min-w-0">
                  <div className="text-xs text-muted">{r.label}</div>
                  <div className="font-semibold">{r.value}</div>
                  <div className="truncate text-xs text-ink-2">{r.detail}</div>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
