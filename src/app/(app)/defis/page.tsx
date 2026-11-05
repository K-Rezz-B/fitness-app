import type { Metadata } from "next";
import clsx from "clsx";
import { Lock, Users } from "lucide-react";
import { getChallengeBoard } from "@/lib/data";
import { requireProfile } from "@/lib/session";
import { workoutXp } from "@/lib/stats";
import { addDays, dayKey, fmtDate, keyToUTC, today, weekStart } from "@/lib/dates";
import { toggleChallenges } from "@/app/actions";
import { PageHeader, Progress } from "@/components/ui";
import { CountUp } from "@/components/count-up";
import { ProgressLinks } from "@/components/progress-links";

export const metadata: Metadata = { title: "Défis" };

const MEDALS = ["🥇", "🥈", "🥉"];

type Row = { profileId: number; date: Date; durationMin: number; rpe: number };

/** Classement d'une semaine : XP gagnée (récompense l'effort), puis séances. */
function standings(people: { id: number; name: string; emoji: string; target: number }[], rows: Row[], from: string) {
  const to = addDays(from, 7);
  return people
    .map((p) => {
      const mine = rows.filter((r) => r.profileId === p.id && dayKey(r.date) >= from && dayKey(r.date) < to);
      return {
        ...p,
        sessions: mine.length,
        minutes: mine.reduce((s, r) => s + r.durationMin, 0),
        xp: mine.reduce((s, r) => s + workoutXp(r), 0),
        goal: Math.min(1, mine.length / Math.max(1, p.target)),
      };
    })
    .sort((a, b) => b.xp - a.xp || b.sessions - a.sessions);
}

export default async function Defis() {
  const me = await requireProfile();

  if (!me.shareChallenges) {
    return (
      <>
        <PageHeader title="Défis" subtitle="Classement de la semaine entre profils" />
        <ProgressLinks current="defis" />
        <section className="glow animate-pop flex flex-col items-center rounded-3xl border border-line px-6 py-12 text-center">
          <div className="text-6xl">🏁</div>
          <h2 className="mt-3 text-lg font-bold">Défie les autres profils</h2>
          <p className="mt-2 max-w-sm text-sm text-ink-2">
            Chaque semaine, les profils participants sont classés selon l&apos;XP gagnée. Seuls ton prénom, ton emoji, ton nombre de séances, tes minutes et ton XP de la semaine sont visibles : jamais tes séances, ton poids ni tes notes.
          </p>
          <form action={toggleChallenges} className="mt-6">
            <button className="btn-primary"><Users size={16} /> Participer aux défis</button>
          </form>
          <p className="mt-3 flex items-center gap-1 text-xs text-muted"><Lock size={12} /> Tu ne vois le classement que si tu y participes.</p>
        </section>
      </>
    );
  }

  const ws = weekStart(today());
  const lastWs = addDays(ws, -7);
  // Marge d'un jour de chaque côté : le découpage exact se fait au fuseau de l'app (dayKey)
  const { people, rows } = await getChallengeBoard(keyToUTC(addDays(lastWs, -1)), keyToUTC(addDays(ws, 8)));
  const board = standings(people, rows, ws);
  const last = standings(people, rows, lastWs).filter((p) => p.xp > 0);
  const podium = board.slice(0, 3);
  const leader = board[0];

  return (
    <>
      <PageHeader title="Défis" subtitle={`Semaine du ${fmtDate(ws)} · ${people.length} participant(s)`} />
      <ProgressLinks current="defis" />

      {people.length < 2 && (
        <p className="card mb-4 text-sm text-ink-2">
          Tu es seul·e pour l&apos;instant 👀 Invite les autres profils à ouvrir l&apos;onglet Défis pour participer.
        </p>
      )}

      {/* Podium : 2e – 1er – 3e */}
      {podium.some((p) => p.xp > 0) && (
        <section className="glow mb-4 rounded-3xl border border-line px-4 pt-6 pb-0">
          <div className="flex items-end justify-center gap-3">
            {[podium[1], podium[0], podium[2]].map((p, i) => {
              if (!p) return <div key={`vide-${i}`} className="w-24" />;
              const rank = board.indexOf(p);
              const h = rank === 0 ? "h-28" : rank === 1 ? "h-20" : "h-14";
              return (
                <div key={p.id} className="flex w-24 flex-col items-center">
                  <div className={clsx("animate-pop text-4xl", rank === 0 && "animate-pulse-soft")} style={{ animationDelay: `${(2 - rank) * 150}ms` }}>{p.emoji}</div>
                  <div className={clsx("mt-1 max-w-full truncate text-sm font-semibold", p.id === me.id && "text-accent")}>{p.name || "—"}</div>
                  <div className="font-mono text-xs text-ink-2 tabular-nums"><CountUp value={p.xp} /> XP</div>
                  <div
                    className={clsx("animate-grow-y mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2 text-2xl", h, rank === 0 ? "bg-accent/20" : "bg-surface-2")}
                    style={{ animationDelay: `${(2 - rank) * 150}ms` }}
                  >
                    {MEDALS[rank]}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="card mb-4">
        <div className="mb-3 text-sm font-semibold">Classement de la semaine</div>
        <ol className="space-y-2">
          {board.map((p, i) => (
            <li
              key={p.id}
              className={clsx("animate-fade-up rounded-2xl px-4 py-3", p.id === me.id ? "border border-accent/30 bg-accent/5" : "bg-surface-2")}
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-center gap-3">
                <span className="w-6 text-center font-mono text-sm text-muted">{MEDALS[i] && p.xp > 0 ? MEDALS[i] : i + 1}</span>
                <span className="text-2xl">{p.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{p.name || "—"}{p.id === me.id && <span className="ml-1 text-xs font-normal text-muted">(toi)</span>}</span>
                  <span className="block text-xs text-ink-2">{p.sessions}/{p.target} séance(s) · {p.minutes} min</span>
                </span>
                <span className="font-mono text-sm font-bold tabular-nums">{p.xp} <span className="text-xs font-normal text-muted">XP</span></span>
              </div>
              <Progress value={p.goal} className="mt-2 h-1.5" />
            </li>
          ))}
        </ol>
        {leader && leader.id !== me.id && leader.xp > 0 && (() => {
          const mine = board.find((p) => p.id === me.id)!;
          return <p className="mt-3 text-xs text-ink-2">🎯 Il te manque <b className="font-mono">{leader.xp - mine.xp} XP</b> pour passer en tête (~{Math.ceil((leader.xp - mine.xp) / 150)} séance(s) d&apos;une heure modérée).</p>;
        })()}
      </section>

      {last.length > 0 && (
        <section className="card mb-4">
          <div className="text-sm font-semibold">Semaine dernière</div>
          <p className="mt-1 text-sm text-ink-2">
            {MEDALS[0]} {last[0].emoji} <b>{last[0].name}</b> a gagné avec {last[0].xp} XP
            {last[1] && <> · {MEDALS[1]} {last[1].emoji} {last[1].name} ({last[1].xp} XP)</>}
          </p>
        </section>
      )}

      <form action={toggleChallenges} className="text-center">
        <button className="text-xs text-muted underline">Ne plus participer aux défis</button>
      </form>
    </>
  );
}
