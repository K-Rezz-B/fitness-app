import Link from "next/link";
import { Flame, Trophy, Timer, Target, Sparkles, CalendarDays, CalendarPlus, CalendarX2, ChevronRight, Clock } from "lucide-react";
import { getActivity, getPlanMoves, getPlans, getVideos, getWorkouts } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { computeStats } from "@/lib/stats";
import { suggest, templateById } from "@/lib/templates";
import { WEEKDAYS, typeInfo } from "@/lib/constants";
import { addDays, dayKey, diffDays, fmtDate, fmtTime, isoWeekday, today, weekStart } from "@/lib/dates";
import { templatesForProfile } from "@/lib/coach-plan";
import { dayLabel, nextSession, sessionHref, sessionsBetween, type Session } from "@/lib/schedule";
import { MoveSession } from "@/components/move-session";
import { coachVideosFor } from "@/lib/video-coach";
import { CoachVideo } from "@/components/coach-video";
import { PageHeader, Progress, Stat } from "@/components/ui";
import { ActivityRings, Heatmap, ScoreRing, SplitBar, StepsBars } from "@/components/viz";
import { WeeklyChart } from "@/components/charts";
import { CountUp } from "@/components/count-up";
import { Celebration } from "@/components/celebration";
import { ProgressLinks } from "@/components/progress-links";
import type { NewRecord } from "@/lib/records";

const QUOTES = [
  "La discipline, c'est choisir entre ce que tu veux maintenant et ce que tu veux le plus.",
  "Tu ne regretteras jamais une séance faite.",
  "Petit progrès chaque jour = gros résultats.",
  "Le plus dur, c'est de mettre ses baskets.",
  "Ton futur toi te remercie déjà.",
  "La motivation te lance, l'habitude te fait avancer.",
  "Pas besoin d'être extrême, juste constant.",
];

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Records passés dans l'URL par saveWorkout (on ne garde que des valeurs bien formées). */
function parseRecords(raw: string | string[] | undefined): NewRecord[] {
  try {
    const list = JSON.parse(typeof raw === "string" ? raw : "[]");
    return (Array.isArray(list) ? list : [])
      .filter((r) => r && typeof r.name === "string" && ["charge", "1RM", "reps"].includes(r.kind) && Number.isFinite(r.value) && Number.isFinite(r.previous))
      .slice(0, 3);
  } catch {
    return [];
  }
}

export default async function Dashboard({ searchParams }: PageProps<"/">) {
  const profile = await requireProfile();
  const [all, videos, plans, moves, activity, sp] = await Promise.all([
    getWorkouts(profile.id), getVideos(profile.id), getPlans(profile.id), getPlanMoves(profile.id), getActivity(profile.id, 7), searchParams,
  ]);
  const target = profile.weeklySessionsTarget;
  const s = computeStats(all, target);
  const t = today();
  const now = fmtTime(new Date());
  const ws = weekStart(t);
  const doneToday = all.filter((w) => dayKey(w.date) === t);

  // ---- Agenda : 7 derniers jours (séances manquées) + semaine en cours + 14 prochains jours ----
  const sessions = sessionsBetween(plans, moves, all, addDays(t, -7) < ws ? addDays(t, -7) : ws, addDays(t, 14));
  const missed = sessions.filter((x) => !x.done && x.date < t && x.date >= addDays(t, -7)).reverse();
  const hero = sessions.find((x) => x.date === t && !x.done) ?? nextSession(sessions, t, now);
  const heroToday = hero?.date === t;
  const upcoming = sessions.filter((x) => !x.done && x.date >= t && x !== hero).slice(0, 6);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i)).map((date) => {
    const planned = sessions.filter((x) => x.date === date);
    const logged = all.filter((w) => dayKey(w.date) === date);
    return { date, planned, extra: Math.max(0, logged.length - planned.filter((x) => x.done).length) };
  });
  const mv = (x: Session) => ({ planId: x.planId, moveId: x.moveId, date: x.date, time: x.time, title: x.title, emoji: typeInfo(x.type).emoji });

  // ---- Sans séance prévue : suggestion faisable avec ton matériel ----
  const { list: doable, known: equipmentKnown } = templatesForProfile(profile);
  const suggested = suggest(all.slice(0, 20), target, doable);
  const heroTpl = hero?.templateId ? templateById(hero.templateId) : undefined;
  const template = hero ? heroTpl : suggested.template;
  const coachVideo = coachVideosFor({
    library: videos,
    session: hero
      ? { templateId: hero.templateId, type: hero.type, durationMin: hero.durationMin }
      : { templateId: suggested.template.id, type: suggested.template.type, durationMin: suggested.template.durationMin },
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
        <Celebration
          xp={Number(sp.xp) || 0}
          level={Number(sp.lvl) || undefined}
          badges={s.badges.filter((b) => String(sp.b ?? "").split(",").includes(b.id))}
          records={parseRecords(sp.pr)}
        />
      )}

      {/* Séances manquées : à décaler ou à sauter */}
      {missed.length > 0 && (
        <section className="card mb-4 border-warning/40">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <CalendarX2 size={16} className="text-warning" /> {missed.length > 1 ? `${missed.length} séances manquées` : "Séance manquée"}
            <span className="font-normal text-muted">· pas grave, on la recale ?</span>
          </div>
          <ul className="space-y-2">
            {missed.map((x) => (
              <li key={x.key} className="flex items-center justify-between gap-3 rounded-2xl bg-surface-2 px-4 py-3">
                <span className="min-w-0 text-sm">
                  <span className="text-muted">{cap(dayLabel(x.date, t))} {x.time}</span> · {typeInfo(x.type).emoji} <b>{x.title}</b>
                </span>
                <MoveSession session={mv(x)} today={t} className="shrink-0 px-3 py-1.5 text-xs" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* PROCHAINE SÉANCE + SEMAINE */}
      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        <section className="glow rounded-3xl border border-line p-5 sm:p-6 lg:col-span-3">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-accent" />
            {hero ? (heroToday ? "Séance du jour" : "Prochaine séance") : "Séance suggérée"}
            {hero && (
              <span className="chip ml-auto">
                <Clock size={12} /> {cap(dayLabel(hero.date, t))} · {hero.time}
                {!heroToday && ` · dans ${diffDays(hero.date, t)} j`}
              </span>
            )}
          </div>

          {hero && !heroToday && (
            <p className="mb-4 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">
              {doneToday.length
                ? "Séance du jour faite ✅ Bien joué, profite de la récup."
                : "Rien de prévu aujourd'hui 😌 La récupération fait partie du programme."}
              {!doneToday.length && (
                <> <Link href="/workouts/new?template=mobility" className="text-accent">Mobilité douce (facultatif)</Link></>
              )}
            </p>
          )}

          <div className="flex items-start gap-4">
            <div className="text-5xl">{typeInfo(hero?.type ?? suggested.template.type).emoji}</div>
            <div className="min-w-0 flex-1">
              <h2 className="text-2xl font-bold tracking-tight">{hero?.title ?? suggested.template.title}</h2>
              <p className="mt-1 text-sm text-ink-2">
                {template ? `${template.focus} · ` : `${typeInfo(hero!.type).label} · `}
                {hero?.durationMin ?? suggested.template.durationMin} min
                {(hero ? hero.rpe ?? template?.rpe : suggested.template.rpe) ? ` · RPE ${hero ? hero.rpe ?? template?.rpe : suggested.template.rpe}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {hero?.source === "coach" && <span className="chip">🧠 Coach</span>}
                {hero?.movedFrom && <span className="chip">🔁 Décalée du {dayLabel(hero.movedFrom, t)}</span>}
              </div>
            </div>
          </div>

          {(hero ? hero.notes : suggested.reason) && (
            <p className="mt-4 rounded-xl bg-surface-2 p-3 text-xs text-ink-2">💡 {hero ? hero.notes : suggested.reason}</p>
          )}

          {template && (
            <ul className="mt-4 space-y-1 text-sm">
              {template.exercises.slice(0, 5).map((e) => (
                <li key={e.name} className="flex justify-between gap-2">
                  <span className="truncate">{e.name}</span>
                  <span className="shrink-0 font-mono text-xs text-muted">{e.sets}×{e.reps}</span>
                </li>
              ))}
            </ul>
          )}

          <div className="mt-5 flex flex-wrap gap-2">
            {hero ? (
              <>
                {heroToday ? (
                  <Link href={`${sessionHref(hero)}&live=1`} className="btn-primary">C&apos;est parti</Link>
                ) : (
                  <Link href={sessionHref(hero)} className="btn-ghost">La faire maintenant</Link>
                )}
                <MoveSession session={mv(hero)} today={t} />
              </>
            ) : (
              <>
                <Link href={`/workouts/new?template=${suggested.template.id}&live=1`} className="btn-primary">C&apos;est parti</Link>
                <Link href="/planning" className="btn-ghost"><CalendarPlus size={14} /> Planifier mes séances</Link>
              </>
            )}
          </div>
          <div className="mt-4">
            <CoachVideo result={coachVideo} />
          </div>
          {!hero && !equipmentKnown && (
            <p className="mt-3 text-xs text-muted">
              Suggestions sans matériel pour l&apos;instant.{" "}
              <Link href="/planning#coach" className="text-accent">Indique ton matériel</Link> (salle, haltères…) pour des séances adaptées.
            </p>
          )}
        </section>

        <div className="flex flex-col gap-4 lg:col-span-2">
          {/* Ma semaine */}
          <section className="card">
            <div className="mb-3 flex items-baseline justify-between text-sm font-semibold">
              <span>Ma semaine</span>
              <span className="font-mono text-xs text-ink-2 tabular-nums">{s.current.sessions}/{target} séances</span>
            </div>
            <Progress value={s.current.sessions / Math.max(1, target)} />
            <div className="mt-4 grid grid-cols-7 gap-1 text-center">
              {week.map((d) => (
                <div key={d.date} className={`rounded-2xl px-0.5 py-2 ${d.date === t ? "bg-accent/10 ring-1 ring-accent/40" : ""}`}>
                  <div className="text-[10px] text-muted uppercase">{WEEKDAYS[isoWeekday(d.date) - 1].slice(0, 3)}</div>
                  <div className="font-mono text-sm font-semibold tabular-nums">{Number(d.date.slice(8))}</div>
                  <div className="mt-1 flex min-h-6 flex-col items-center gap-0.5 text-sm leading-none">
                    {d.planned.map((x) => (
                      <span
                        key={x.key}
                        title={`${x.time} · ${x.title}${x.done ? " (faite)" : x.date < t ? " (manquée)" : ""}`}
                        className={x.done ? "" : x.date < t ? "opacity-40 grayscale" : "opacity-70"}
                      >
                        {x.done ? "✅" : x.date < t ? "✖️" : typeInfo(x.type).emoji}
                      </span>
                    ))}
                    {d.extra > 0 && <span title="Séance en plus">💪</span>}
                    {!d.planned.length && !d.extra && <span className="text-muted">·</span>}
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 text-[11px] text-muted">✅ faite · ✖️ manquée · emoji = prévue · 💪 en plus</p>
          </section>

          {/* À venir */}
          <section className="card flex-1">
            <div className="mb-3 flex items-center justify-between text-sm font-semibold">
              <span className="inline-flex items-center gap-2"><CalendarDays size={16} className="text-accent" /> À venir</span>
              <Link href="/planning" className="inline-flex items-center text-xs font-normal text-muted hover:text-ink">Planning <ChevronRight size={14} /></Link>
            </div>
            {upcoming.length ? (
              <ul className="space-y-2">
                {upcoming.map((x) => (
                  <li key={x.key} className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3 py-2.5">
                    <div className="w-12 shrink-0 text-center">
                      <div className="text-[10px] text-muted uppercase">{x.date === t ? "Auj." : WEEKDAYS[isoWeekday(x.date) - 1].slice(0, 3)}</div>
                      <div className="font-mono text-base font-semibold tabular-nums">{Number(x.date.slice(8))}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{typeInfo(x.type).emoji} {x.title}</div>
                      <div className="text-xs text-muted">
                        {x.time} · {x.durationMin} min{x.movedFrom ? " · 🔁 décalée" : ""}
                      </div>
                    </div>
                    <MoveSession session={mv(x)} today={t} label="" className="shrink-0 px-2.5 py-1.5 text-xs" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">
                Rien d&apos;autre de prévu.{" "}
                <Link href="/planning" className="text-accent">Ajoute tes créneaux</Link> ou laisse le coach planifier ta semaine.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* Forme */}
      <section className="card mb-4">
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <div className="flex flex-col items-center">
            <ScoreRing score={s.score} size={120} />
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
              <span className="font-mono text-xs text-ink-2 tabular-nums"><CountUp value={s.xp} /> XP</span>
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
        <Stat label="Minutes / sem." value={<CountUp value={s.current.minutes} />} unit="min" sub={<span className="inline-flex items-center gap-1"><Timer size={12} /> {s.who7} min éq. OMS (7 j)</span>} />
        <Stat label="Série" value={<CountUp value={s.weekStreak} />} unit="sem." sub={<span className="inline-flex items-center gap-1"><Flame size={12} className="text-cardio" /> {s.dayStreak} jour(s) d&apos;affilée</span>} />
        <Stat label="Total" value={<CountUp value={s.totalSessions} />} unit="séances" sub={`${Math.round(s.totalMin / 60)} h · ${s.totalKm.toFixed(0)} km`} />
      </section>

      <ProgressLinks />

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

      <section className="card mb-4">
        <div className="mb-3 text-sm font-semibold">Minutes par semaine</div>
        <WeeklyChart data={weekData} />
      </section>

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
          {s.badges.map((b, i) => (
            <div key={b.id} style={{ animationDelay: `${i * 40}ms` }} className={`animate-pop rounded-2xl border p-3 text-center ${b.got ? "border-accent/30 bg-accent/5" : "border-line opacity-40 grayscale"}`}>
              <div className="text-2xl">{b.emoji}</div>
              <div className="mt-1 text-xs font-medium">{b.label}</div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
