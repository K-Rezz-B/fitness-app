"use client";
import { useEffect, useState } from "react";
import type { NewRecord } from "@/lib/records";
import { buzz, confetti } from "./confetti";
import { Sheet } from "./sheet";

const nf = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const KIND = { charge: "charge max", "1RM": "1RM estimé", reps: "reps" } as const;
const unit = (r: NewRecord) => (r.kind === "reps" ? "reps" : "kg");

/** Fête une séance enregistrée : confettis + bandeau, et une carte si niveau, badge ou record. */
export function Celebration({
  xp,
  level,
  badges,
  records,
}: {
  xp: number;
  level?: number;
  badges: { emoji: string; label: string }[];
  records: NewRecord[];
}) {
  const big = !!level || badges.length > 0 || records.length > 0;
  const [open, setOpen] = useState(big);

  useEffect(() => {
    confetti(big ? { count: 220, duration: 3400 } : {});
    buzz(big ? [40, 60, 40, 60, 80] : 30);
    // URL nettoyée sans navigation : un rechargement ne rejoue pas la fête
    window.history.replaceState(null, "", "/");
  }, [big]);

  return (
    <>
      <div className="animate-pop mb-4 rounded-2xl border border-accent/30 bg-accent/10 px-4 py-3 text-sm text-accent">
        ✅ Séance enregistrée ! <b className="font-mono">+{xp} XP</b> — continue comme ça.
      </div>

      {big && (
        <Sheet open={open} onClose={() => setOpen(false)} className="glow" narrow>
          <div className="pb-4 text-center sm:pt-1">

            {level ? (
              <>
                <div className="animate-pulse-soft text-6xl">⚡</div>
                <div className="mt-2 text-xs font-semibold tracking-widest text-muted uppercase">Niveau supérieur</div>
                <div className="text-shine font-mono text-5xl font-bold">NIV. {level}</div>
              </>
            ) : records.length ? (
              <>
                <div className="animate-pulse-soft text-6xl">🏆</div>
                <div className="text-shine mt-2 text-2xl font-bold">{records.length > 1 ? "Nouveaux records !" : "Nouveau record !"}</div>
              </>
            ) : (
              <>
                <div className="animate-pulse-soft text-6xl">🎉</div>
                <div className="text-shine mt-2 text-2xl font-bold">{badges.length > 1 ? "Nouveaux badges !" : "Nouveau badge !"}</div>
              </>
            )}

            {records.length > 0 && (
              <ul className="mt-5 space-y-2 text-left">
                {records.map((r, i) => (
                  <li key={r.name} className="animate-fade-up rounded-2xl bg-surface-2 px-4 py-3" style={{ animationDelay: `${300 + i * 120}ms` }}>
                    <div className="text-sm font-semibold">🏆 {r.name}</div>
                    <div className="text-xs text-ink-2">
                      {KIND[r.kind]} : <b className="font-mono text-accent">{nf.format(r.value)} {unit(r)}</b>{" "}
                      <span className="text-muted">(avant {nf.format(r.previous)} {unit(r)})</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {badges.length > 0 && (
              <div className="mt-5 flex flex-wrap justify-center gap-2">
                {badges.map((b, i) => (
                  <div key={b.label} className="animate-pop rounded-2xl border border-accent/30 bg-accent/5 px-3 py-2" style={{ animationDelay: `${400 + i * 150}ms` }}>
                    <div className="text-3xl">{b.emoji}</div>
                    <div className="mt-1 text-xs font-medium">{b.label}</div>
                  </div>
                ))}
              </div>
            )}

            <button type="button" onClick={() => setOpen(false)} autoFocus className="btn-primary mt-6 w-full">
              Trop bien 💪
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
