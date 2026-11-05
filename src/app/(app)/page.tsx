import Link from "next/link";
import { Flame, Trophy, Timer, Target, Sparkles, PlayCircle, CalendarCheck2 } from "lucide-react";
import { getPlans, getProfile, getVideos, getWorkouts } from "@/lib/data";
import { computeStats } from "@/lib/stats";
import { suggest } from "@/lib/templates";
import { typeInfo } from "@/lib/constants";
import { dayKey, fmtDate, isoWeekday, today } from "@/lib/dates";
import { PageHeader, Progress, Stat } from "@/components/ui";
import { Heatmap, ScoreRing, SplitBar } from "@/components/viz";
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
  const [profile, all, videos, plans, sp] = await Promise.all([getProfile(), getWorkouts(), getVideos(), getPlans(), searchParams]);
  const target = profile?.weeklySessionsTarget ?? 3;
  const s = computeStats(all, target);
  const t = today();
  const { template, reason } = suggest(all.slice(0, 20), target);
  const video = videos.find((v) => v.type === template.type) ?? videos.find((v) => v.tags.some((tag) => typeInfo(template.type).label.toLowerCase().includes(tag)));
  const todayPlans = plans.filter((p) => p.active && p.weekday === isoWeekday(t));
  const doneToday = all.filter((w) => dayKey(w.date) === t);
  const quote = QUOTES[Number(t.replaceAll("-", "")) % QUOTES.length];

  const weekData = s.weeks.map((w) => ({
    label: fmtDate(w.week),
    ...w.byCat,
    sessions: w.sessions,
  }));

  return (
    <>
      <PageHeader
        title={`Salut${profile?.name ? ` ${profile.name}` : ""} 👋`}
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

      <div className="mb-4 grid gap-4 lg:grid-cols-5">
        {/* Suggestion */}
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Sparkles size={16} className="text-accent" /> Séance suggérée
          </div>
          <div className="text-3xl">{typeInfo(template.type).emoji}</div>
          <h3 className="mt-2 text-lg font-bold">{template.title}</h3>
          <p className="text-sm text-ink-2">{template.focus} · {template.durationMin} min · RPE {template.rpe}</p>
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
            <Link href={`/workouts/new?template=${template.id}`} className="btn-primary">C&apos;est parti</Link>
            {video && (
              <a href={video.url} target="_blank" rel="noreferrer" className="btn-ghost">
                <PlayCircle size={16} /> Vidéo
              </a>
            )}
          </div>
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
                  {!done && <Link href={`/workouts/new?type=${p.type}&title=${encodeURIComponent(p.title)}&duration=${p.durationMin}`} className="btn-primary px-3 py-1.5 text-xs">Valider</Link>}
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
