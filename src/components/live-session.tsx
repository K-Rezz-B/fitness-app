"use client";
import { useEffect, useState } from "react";
import { Pause, Plus, SkipForward, Square, Timer } from "lucide-react";
import { buzz } from "./confetti";

export const REST_CHOICES = [60, 90, 120, 180];

const mmss = (sec: number) => {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${r}` : `${m}:${r}`;
};

/** Horloge qui se met à jour chaque seconde (et au retour dans l'app : les minuteurs sont gelés en arrière-plan). */
function useNow(active = true) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 250);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [active]);
  return now;
}

// ---------- Son de fin de repos ----------
let audio: AudioContext | null = null;
/** À appeler pendant un geste (tap) : iOS n'autorise le son qu'après une interaction. */
export function unlockAudio() {
  try {
    audio ??= new AudioContext();
    if (audio.state === "suspended") audio.resume();
  } catch {}
}
function beep() {
  if (!audio) return;
  const t = audio.currentTime;
  [0, 0.18, 0.36].forEach((d, i) => {
    const o = audio!.createOscillator();
    const g = audio!.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, t + d);
    g.gain.exponentialRampToValueAtTime(0.25, t + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
    o.connect(g).connect(audio!.destination);
    o.start(t + d);
    o.stop(t + d + 0.16);
  });
}
async function notifyRestOver() {
  if (!document.hidden || typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const reg = await navigator.serviceWorker?.ready;
    await reg?.showNotification("⏱️ Repos terminé", { body: "Série suivante, c'est parti 💪", tag: "rest", icon: "/icons/icon-192.png" });
  } catch {}
}

// ---------- Barre « séance en direct » ----------
export function LiveBar({
  startedAt,
  restSec,
  onRestSec,
  onFinish,
  onCancel,
  doneSets,
  totalSets,
}: {
  startedAt: number;
  restSec: number;
  onRestSec: (s: number) => void;
  onFinish: () => void;
  onCancel: () => void;
  doneSets: number;
  totalSets: number;
}) {
  const now = useNow();
  return (
    <section className="animate-fade-up glow sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 rounded-3xl border border-accent/30 p-4 shadow-2xl shadow-black/40">
      <div className="flex items-center gap-3">
        <span className="relative flex h-3 w-3 shrink-0">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-critical opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-critical" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">Séance en direct</div>
          <div className="font-mono text-3xl font-bold tabular-nums">{mmss((now - startedAt) / 1000)}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-lg font-semibold tabular-nums">
            {doneSets}<span className="text-muted">/{totalSets}</span>
          </div>
          <div className="text-[11px] text-muted">séries</div>
        </div>
      </div>
      {totalSets > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
          <div className="h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${(doneSets / totalSets) * 100}%` }} />
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 text-xs text-muted"><Timer size={14} /> Repos</span>
        {REST_CHOICES.map((s) => (
          <button key={s} type="button" onClick={() => onRestSec(s)} className={`chip transition ${restSec === s ? "border-accent bg-accent/10 text-accent" : ""}`}>
            {s < 120 ? `${s} s` : `${s / 60} min`}
          </button>
        ))}
        <div className="ml-auto flex gap-2">
          <button type="button" onClick={onCancel} className="btn-ghost px-3 py-1.5 text-xs" aria-label="Abandonner la séance en direct">
            <Pause size={14} />
          </button>
          <button type="button" onClick={onFinish} className="btn-primary px-3 py-1.5 text-xs">
            <Square size={12} fill="currentColor" /> Terminer
          </button>
        </div>
      </div>
    </section>
  );
}

// ---------- Minuteur de repos ----------
export function RestTimer({ endsAt, total, onChange, onDone }: { endsAt: number; total: number; onChange: (endsAt: number, total: number) => void; onDone: () => void }) {
  const now = useNow();
  const left = Math.max(0, (endsAt - now) / 1000);
  const over = left <= 0;

  useEffect(() => {
    const ms = endsAt - Date.now();
    if (ms <= 0) return;
    const id = setTimeout(() => {
      beep();
      buzz([200, 100, 200]);
      notifyRestOver();
    }, ms);
    return () => clearTimeout(id);
  }, [endsAt]);

  useEffect(() => {
    if (!over) return;
    const id = setTimeout(onDone, 2500);
    return () => clearTimeout(id);
  }, [over, onDone]);

  const r = 26;
  const c = 2 * Math.PI * r;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-50 flex justify-center px-4" style={{ bottom: "calc(env(safe-area-inset-bottom) + 84px)" }}>
      <div className={`animate-pop pointer-events-auto flex w-full max-w-sm items-center gap-4 rounded-3xl border p-3 pr-4 shadow-2xl shadow-black/50 backdrop-blur-xl ${over ? "border-accent bg-accent/15" : "border-line bg-surface-2/95"}`}>
        <svg width={64} height={64} className="-rotate-90 shrink-0">
          <circle cx={32} cy={32} r={r} stroke="#2a2a2e" strokeWidth={6} fill="none" />
          <circle
            cx={32}
            cy={32}
            r={r}
            stroke="#c6f432"
            strokeWidth={6}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - left / total)}
            className="transition-[stroke-dashoffset] duration-300 ease-linear"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-wide text-muted uppercase">{over ? "Repos terminé" : "Repos"}</div>
          <div className={`font-mono text-3xl font-bold tabular-nums ${over ? "animate-pulse-soft text-accent" : ""}`}>{over ? "Go 💪" : mmss(left)}</div>
        </div>
        {!over && (
          <>
            <button type="button" onClick={() => onChange(endsAt + 15_000, total + 15)} className="btn-ghost px-2.5 py-2 text-xs" aria-label="Ajouter 15 secondes">
              <Plus size={14} />15
            </button>
            <button type="button" onClick={onDone} className="btn-ghost px-2.5 py-2" aria-label="Passer le repos">
              <SkipForward size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Brouillon de la séance en cours (survit à un rechargement ou à la mise en veille) ----------
export type LiveDraft<T> = { startedAt: number; restSec: number; state: T };
const draftKey = (pid: number) => `fitpulse:live:${pid}`;

export const draftSnapshot = (pid: number) => localStorage.getItem(draftKey(pid));
export function parseDraft<T>(raw: string | null): LiveDraft<T> | null {
  try {
    const d = JSON.parse(raw ?? "null");
    return d && typeof d.startedAt === "number" ? d : null;
  } catch {
    return null;
  }
}
export const readDraft = <T,>(pid: number) => parseDraft<T>(draftSnapshot(pid));
/** Le brouillon change aussi dans un autre onglet (événement storage). */
export function subscribeDraft(cb: () => void) {
  window.addEventListener("storage", cb);
  return () => window.removeEventListener("storage", cb);
}
export const writeDraft = <T,>(pid: number, d: LiveDraft<T>) => localStorage.setItem(draftKey(pid), JSON.stringify(d));
export const clearDraft = (pid: number) => localStorage.removeItem(draftKey(pid));
