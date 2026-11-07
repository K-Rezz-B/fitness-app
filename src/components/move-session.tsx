"use client";
import { useState, useTransition } from "react";
import clsx from "clsx";
import { CalendarClock, X } from "lucide-react";
import { moveSession } from "@/app/actions";

const addDays = (key: string, n: number) => {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const fmt = (key: string, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("fr-FR", { timeZone: "UTC", ...opts }).format(new Date(`${key}T00:00:00Z`));

/** Bouton « Décaler » : choisir un autre jour / une autre heure pour une seule séance, ou la sauter. */
export function MoveSession({
  session,
  today,
  label = "Décaler",
  className,
}: {
  session: { planId: number | null; moveId: number | null; date: string; time: string; title: string; emoji: string };
  today: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const days = Array.from({ length: 8 }, (_, i) => addDays(today, i)).filter((d) => d !== session.date);
  const [day, setDay] = useState(days[0]);
  const [time, setTime] = useState(session.time);

  const send = (toDate: string) =>
    start(async () => {
      const f = new FormData();
      if (session.moveId) f.set("moveId", String(session.moveId));
      if (session.planId) f.set("planId", String(session.planId));
      f.set("fromDate", session.date);
      f.set("toDate", toDate);
      f.set("toTime", time);
      await moveSession(f);
      setOpen(false);
    });

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={label ? undefined : "Décaler"} title="Décaler cette séance" className={clsx("btn-ghost", className)}>
        <CalendarClock size={14} />{label && ` ${label}`}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={() => !pending && setOpen(false)}>
          <div role="dialog" aria-modal aria-label={`Décaler ${session.title}`} className="card animate-pop w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold">{session.emoji} Décaler « {session.title} »</div>
                <div className="text-xs text-muted">Prévue le {fmt(session.date, { weekday: "long", day: "numeric", month: "long" })} à {session.time} · seule cette séance bouge</div>
              </div>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="text-muted hover:text-ink"><X size={18} /></button>
            </div>

            <div className="label">Nouveau jour</div>
            <div className="grid grid-cols-4 gap-2">
              {days.map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={clsx("rounded-2xl border px-2 py-2 text-center transition", d === day ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface-2 text-ink-2 hover:bg-line")}
                >
                  <div className="text-[11px] uppercase">{d === today ? "Auj." : d === addDays(today, 1) ? "Demain" : fmt(d, { weekday: "short" })}</div>
                  <div className="font-mono text-lg font-semibold tabular-nums">{fmt(d, { day: "numeric" })}</div>
                </button>
              ))}
            </div>

            <label className="label mt-4" htmlFor="move-time">Heure</label>
            <input id="move-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} required className="input" />

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={pending || !time} onClick={() => send(day)} className="btn-primary flex-1">
                {pending ? "…" : `Décaler ${d2(day, today)}`}
              </button>
              <button type="button" disabled={pending} onClick={() => send("skip")} className="btn-ghost">
                Sauter cette séance
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

const d2 = (d: string, today: string) =>
  d === today ? "à aujourd'hui" : d === addDays(today, 1) ? "à demain" : `au ${fmt(d, { weekday: "long", day: "numeric" })}`;
