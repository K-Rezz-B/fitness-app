import Link from "next/link";
import { Flame, Trophy, Timer, Target, Sparkles, CalendarCheck2 } from "lucide-react";
import { getActivity, getPlans, getVideos, getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { computeStats } from "@/lib/stats";
import { suggest, templateById } from "@/lib/templates";
import { WEEKDAYS, typeInfo } from "@/lib/constants";
import { addDays, dayKey, fmtDate, fmtTime, isoWeekday, today } from "@/lib/dates";
import { templatesForProfile, upcomingPlan } from "@/lib/coach-plan";
import { coachVideosFor } from "@/lib/video-coach";
import { CoachVideo } from "@/components/coach-video";
import { PageHeader, Progress, Stat } from "@/components/ui";
import { ActivityRings, Heatmap, ScoreRing, SplitBar, StepsBars } from "@/components/viz";
import { WeeklyChart } from "@/components/charts";

const QUOTES = [
  "La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.",
  "Tu ne regretteras jamais une séance faite.",
  "Petit progrès chaque jour = gros résultats.",
  "Le plus dur, c'est de mettre ses baskets.",
  "Ton futur toi te remercie déjà.",
  "La motivation te lance, l'habitude te fait avancer.",
  "Pas besoin d'être extrême, juste constant.",
];

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const profile = await requireProfile();
  const [all, videos, plans, activity, sp] = await Promise.all([getWorkouts(profile.id), getVideos(profile.id), getPlans(profile.id), getActivity(profile.id, 7), searchParams]);
  const target = profile.weeklySessionsTarget;
  const s = computeStats(all, target);
  const t = today();
  const planHref = (p: (typeof plans)[number]) =>
    p.source === "coach" && p.templateId ? `/workouts/new?plan=${p.id}` : `/workouts/new?type=${p.type}&title=${encodeURIComponent(p.title)}&duration=${p.durationMin}`;
  const wd = isoWeekday(t);
  const todayPlans = plans.filter((p) => p.active && p.weekday === wd);
  const doneToday = all.filter((w) => dayKey(w.date) === t);

  // ---- Carte du jour : séance du coach > jour de récup du programme > suggestion faisable avec ton matériel ----
  const coachPlans = plans.filter((p) => p.source === "coach" && p.active);
  const coachToday = todayPlans.find(
    (p) => p.source === "coach" && p.templateId && !doneToday.some((w) => typeInfo(w.type).category === typeInfo(p.type).category),
  );
  const coachTpl = coachToday ? templateById(coachToday.templateId!) : undefined;
  const restDay = !coachTpl && coachPlans.length > 0; // programme actif mais rien (ou plus rien) à faire aujourd'hui
  const next = restDay ? upcomingPlan(coachPlans, wd, fmtTime(new Date())) : undefined;
  const nextLabel = next
    ? `${next.inDays === 0 ? "aujourd'hui" : next.inDays === 1 ? "demain" : WEEKDAYS[next.plan.weekday - 1].toLowerCase()} ${next.plan.time} · ${next.plan.title}`
    : null;
  const { list: doable, known: equipmentKnown } = templatesForProfile(profile);
  const suggested = suggest(all.slice(0, 20), target, doable);
  const template = coachTpl ?? (restDay ? templateById("mobility")! : suggested.template);
  const cardTitle = coachTpl ? "Séance du jour · coach" : restDay ? (doneToday.length ? "Séance du jour faite ✅" : "Jour de récupération 😌") : "Séance suggérée";
  const reason = coachTpl
    ? `Prévue aujourd'hui par ton coach (${coachToday!.time}) · ${coachToday!.notes ?? ""}`
    : restDay
      ? `${doneToday.length ? "Bien joué ! " : "Ton coach n'a rien prévu aujourd'hui : la récupération fait partie du programme. "}${nextLabel ? `Prochaine séance : ${nextLabel}. ` : ""}Une mobilité douce reste possible si tu en as envie.`
      : suggested.reason;
  const startHref = coachToday && coachTpl ? `/workouts/new?plan=${coachToday.id}` : `/workouts/new?template=${template.id}`;
  // Vidéo du coach : piochée parmi les vidéos du thème de la séance (tags)
  const coachVideo = coachVideosFor({
    library: videos,
    session: coachToday && coachTpl
      ? { templateId: coachToday.templateId, type: coachToday.type, durationMin: coachToday.durationMin }
      : { templateId: template.id, type: template.type, durationMin: template.durationMin },
    profile,
    workouts: all,
    day: t,
  });
  const quote = QUOTES[Number(t.replaceAll("-", "")) % QUOTES.length];

  const weekData = s.weeks.map((w) => ({
    label: fmtDate(w.week),
    ...w.byCat,
    sessions: w.sessions,
  }));

  return (
    <>
      <PageHeader
        title={`Salut${profile.name ? ` ${profile.name}` : ""} 👋`}
        subtitle={new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${t}T00:00:00Z`))}
      />

      {sp.saved && (
        <div className="mb-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
          ✅ Séance enregistrée ! Niveau {s.level} · {s.xp} XP — continue comme ça.
        </div>
      )}

      {/* HERO */}
      <section className="glow mb-4 rounded-3xl border border-line p-5 sm:p-6">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center">
            <ScoreRing score={s.score} />
            <span className="mt-2 text-xs font-medium tracking-wide text-muted uppercase">Score de forme</span>
          </div>
          <div className="w-full flex-1 space-y-3">
            {s.scoreParts.map((p) => (
              <div key={p.label}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{p.label} <span className="text-muted">· {p.weight} pts</span></span>
                  <span className="text-ink-2">{p.hint}</span>
                </div>
                <Progress value={p.value} />
              </div>
            ))}
            <div className="flex items-center gap-3 pt-1">
              <span className="rounded-lg bg-accent-2/20 px-2 py-1 font-mono text-xs font-bold text-accent-2">NIV. {s.level}</span>
              <Progress value={s.levelProgress} className="flex-1" />
              <span className="font-mono text-xs text-ink-2 tabular-nums">{s.xp} XP</span>
            </div>
          </div>
        </div>
        <p className="mt-5 border-t border-line pt-4 text-center text-sm text-ink-2 italic">« {quote} »</p>
      </section>

      {/* KPIs */}
      <section className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Cette semaine"
          value={`${s.current.sessions}/${target}`}
          unit="séances"
          sub={s.current.sessions >= target ? "🎉 Objectif atteint" : `Encore ${target - s.current.sessions} pour l'objectif`}
        />
        <Stat label="Minutes / sem." value={s.current.minutes} unit="min" sub={<span className="inline-flex items-center gap-1"><Timer size={12} /> {s.who7} min éq. OMS (7 j)</span>} />
        <Stat label="Série" value={s.weekStreak} unit="sem." sub={<span className="inline-flex items-center gap-1"><Flame size={12} className="text-cardio" /> {s.dayStreak} jour(s) d&apos;affilée</span>} />
        <Stat label="Total" value={s.totalSessions} unit="séances" sub={`${Math.round(s.totalMin / 60)} h · ${s.totalKm.toFixed(0)} km`} />
      </section>

      {/* Activité du jour (app Forme, via Raccourcis) */}
      {activity.length > 0 && (() => {
        const act = activity.find((a) => a.date === t);
        const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
        const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6)).map((date) => ({ date, steps: activity.find((a) => a.date === date)?.steps ?? null }));
        return (
          <section className="card mb-4">
            <div className="mb-3 flex items-baseline justify-between text-sm font-semibold">
              <span>🔥 Activité du jour <span className="font-normal text-muted">· app Forme</span></span>
              {!act && <span className="text-xs font-normal text-muted">pas encore de données aujourd&apos;hui</span>}
            </div>
            <div className="flex flex-col items-center gap-5 sm:flex-row">
              <ActivityRings kcal={act?.activeKcal ?? 0} kcalGoal={profile.moveGoalKcal} steps={act?.steps ?? 0} stepsGoal={profile.stepsGoal} />
              <div className="grid w-full flex-1 grid-cols-3 gap-2 text-center sm:max-w-xs sm:text-left">
                <div><div className="font-mono text-xl font-semibold text-cardio tabular-nums">{nf.format(act?.activeKcal ?? 0)}</div><div className="text-[11px] text-muted">/ {profile.moveGoalKcal} kcal</div></div>
                <div><div className="font-mono text-xl font-semibold text-accent tabular-nums">{nf.format(act?.steps ?? 0)}</div><div className="text-[11px] text-muted">/ {nf.format(profile.stepsGoal)} pas</div></div>
                <div><div className="font-mono text-xl font-semibold tabular-nums">{nf.format(act?.distanceKm ?? 0)}</div><div className="text-[11px] text-muted">km</div></div>
              </div>
              <div className="w-full sm:flex-1"><StepsBars days={week} goal={profile.stepsGoal} /></div>
            </div>
          </section>
        );
      })()}

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        {/* Suggestion */}
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-accent" /> {cardTitle}
          </div>
          <div className="text-3xl">{typeInfo(template.type).emoji}</div>
          <h3 className="mt-2 text-lg font-bold">{template.title}</h3>
          <p className="text-sm text-ink-2">{template.focus} · {coachToday?.durationMin ?? template.durationMin} min · RPE {coachToday?.rpe ?? template.rpe}</p>
          <p className="mt-3 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">💡 {reason}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {template.exercises.slice(0, 5).map((e) => (
              <li key={e.name} className="flex justify-between gap-2">
                <span className="truncate">{e.name}</span>
                <span className="shrink-0 font-mono text-xs text-muted">{e.sets}×{e.reps}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            {restDay ? (
              <>
                <Link href="/planning#coach" className="btn-primary">Voir le programme</Link>
                <Link href={startHref} className="btn-ghost">Mobilité {template.durationMin} min (facultatif)</Link>
              </>
            ) : (
              <Link href={startHref} className="btn-primary">C&apos;est parti</Link>
            )}
          </div>
          <div className="mt-4">
            <CoachVideo result={coachVideo} />
          </div>
          {!coachTpl && !restDay && !equipmentKnown && (
            <p className="mt-3 text-xs text-muted">
              Suggestions sans matériel pour l&apos;instant.{" "}
              <Link href="/planning#coach" className="text-accent">Indique ton matériel</Link> (salle, haltères…) pour des séances adaptées.
            </p>
          )}
        </section>

        {/* Graph semaines */}
        <section className="card lg:col-span-3">
          <div className="mb-3 text-sm font-semibold">Minutes par semaine</div>
          <WeeklyChart data={weekData} />
        </section>
      </div>

      {/* Aujourd'hui */}
      {(todayPlans.length > 0 || doneToday.length > 0) && (
        <section className="card mb-4">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarCheck2 size={16} className="text-accent" /> Aujourd&apos;hui
          </div>
          <ul className="space-y-2">
            {todayPlans.map((p) => {
              const done = doneToday.some((w) => typeInfo(w.type).category === typeInfo(p.type).category);
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                  <span className="text-sm">
                    {done ? "✅" : "⏳"} <b>{p.time}</b> · {typeInfo(p.type).emoji} {p.title}
                  </span>
                  {!done && <Link href={planHref(p)} className="btn-primary px-3 py-1.5 text-xs">Valider</Link>}
                </li>
              );
            })}
            {todayPlans.length === 0 &&
              doneToday.map((w) => (
                <li key={w.id} className="rounded-2xl bg-surface-2 px-4 py-3 text-sm">✅ {typeInfo(w.type).emoji} {w.title} · {w.durationMin} min</li>
              ))}
          </ul>
        </section>
      )}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <section className="card">
          <div className="mb-3 text-sm font-semibold">Régularité · 18 semaines</div>
          <Heatmap days={s.heat} todayKey={t} />
        </section>
        <section className="card">
          <div className="mb-3 text-sm font-semibold">Répartition · 30 jours</div>
          <SplitBar split={s.split} />
          <div className="mt-5 flex items-center gap-3 border-t border-line pt-4">
            <Target size={18} className="shrink-0 text-accent-2" />
            <div className="text-sm">
              Charge 7 j : <b className="font-mono tabular-nums">{s.acute}</b>
              <div className="text-xs text-muted">durée × RPE (sRPE)</div>
            </div>
            {s.acwr !== null && <span className="chip ml-auto shrink-0">ACWR {s.acwr.toFixed(2)}</span>}
          </div>
        </section>
      </div>

      <section className="card">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Trophy size={16} className="text-warning" /> Badges · {s.badges.filter((b) => b.got).length}/{s.badges.length}
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {s.badges.map((b) => (
            <div key={b.id} className={`rounded-2xl border p-3 text-center ${b.got ? "border-accent/30 bg-accent/5" : "border-line opacity-40 grayscale"}`}>
              <div className="text-2xl">{b.emoji}</div>
              <div className="mt-1 text-xs font-medium">{b.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
