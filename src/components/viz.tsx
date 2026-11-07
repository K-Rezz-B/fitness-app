import type { CSSProperties } from "react";
import { CATEGORIES, type Category } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { CountUp } from "./count-up";

/** Arc animé : se remplit de 0 à `value` (0-1) via stroke-dashoffset (voir .animate-ring). */
function ringStyle(c: number, value: number, delay = 0) {
  return {
    strokeDasharray: c,
    strokeDashoffset: c * (1 - Math.min(1, Math.max(0, value))),
    "--ring-c": `${c}px`,
    animationDelay: `${delay}ms`,
  } as CSSProperties;
}

export function ScoreRing({ score, size = 148 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const c = 2 * Math.PI * r;
  const label = score >= 80 ? "En feu 🔥" : score >= 60 ? "En forme 💪" : score >= 35 ? "Ça monte 📈" : "On s'y remet 🌱";
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs>
          <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#c6f432" />
            <stop offset="100%" stopColor="#9d7bff" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#1f1f22" strokeWidth={12} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="url(#ring)"
          strokeWidth={12}
          fill="none"
          strokeLinecap="round"
          className="animate-ring"
          style={ringStyle(c, score / 100)}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold tabular-nums"><CountUp value={score} duration={1100} /></span>
        <span className="animate-fade-up text-[11px] text-ink-2 [animation-delay:700ms]">{label}</span>
      </div>
    </div>
  );
}

/** Heatmap d'activité (rampe séquentielle bleue, une seule teinte) */
export const STEPS = ["#1f1f22", "#184f95", "#256abf", "#3987e5", "#86b6ef"];
const step = (m: number) => (m === 0 ? 0 : m < 30 ? 1 : m < 60 ? 2 : m < 90 ? 3 : 4);

export function Heatmap({ days, todayKey }: { days: { day: string; minutes: number; count: number }[]; todayKey: string }) {
  const weeks: (typeof days)[] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return (
    <div>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        <div className="mr-1 grid grid-rows-7 gap-[3px] text-[9px] leading-none text-muted">
          {["L", "", "M", "", "V", "", "D"].map((d, i) => (
            <span key={i} className="flex h-3.5 items-center">{d}</span>
          ))}
        </div>
        {weeks.map((w, wi) => (
          <div key={w[0].day} className="animate-fade-up grid grid-rows-7 gap-[3px]" style={{ animationDelay: `${wi * 18}ms` }}>
            {w.map((d) => (
              <div
                key={d.day}
                title={`${fmtDate(d.day, { weekday: "short" })} : ${d.count ? `${d.count} séance(s), ${d.minutes} min` : "repos"}`}
                className="h-3.5 w-3.5 rounded-[3px]"
                style={{
                  background: d.day > todayKey ? "transparent" : STEPS[step(d.minutes)],
                  outline: d.day === todayKey ? "1.5px solid #c6f432" : undefined,
                }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        Moins {STEPS.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />)} Plus
      </div>
    </div>
  );
}

export function SplitBar({ split }: { split: { category: Category; minutes: number }[] }) {
  const total = split.reduce((s, x) => s + x.minutes, 0);
  if (!total) return <p className="text-sm text-muted">Aucune séance sur 30 jours.</p>;
  return (
    <div>
      <div className="animate-grow-x flex h-3 gap-[2px] overflow-hidden rounded-full">
        {split.filter((s) => s.minutes > 0).map((s) => (
          <div key={s.category} style={{ width: `${(s.minutes / total) * 100}%`, background: CATEGORIES[s.category].color }} />
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2">
        {split.map((s) => (
          <div key={s.category}>
            <div className="flex items-center gap-1.5 text-xs text-ink-2">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORIES[s.category].color }} />
              {CATEGORIES[s.category].label}
            </div>
            <div className="font-mono text-lg font-semibold tabular-nums"><CountUp value={Math.round((s.minutes / total) * 100)} /> %</div>
            <div className="font-mono text-xs text-muted tabular-nums">{s.minutes} min</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Deux anneaux concentriques façon app Forme : énergie active (extérieur) et pas (intérieur). */
export function ActivityRings({ kcal, kcalGoal, steps, stepsGoal, size = 120 }: { kcal: number; kcalGoal: number; steps: number; stepsGoal: number; size?: number }) {
  const rings = [
    { value: kcal / Math.max(1, kcalGoal), color: "#d95926", r: size / 2 - 8 },
    { value: steps / Math.max(1, stepsGoal), color: "#c6f432", r: size / 2 - 24 },
  ];
  return (
    <svg width={size} height={size} className="-rotate-90" role="img" aria-label={`Bouger ${Math.round(rings[0].value * 100)} %, pas ${Math.round(rings[1].value * 100)} %`}>
      {rings.map(({ value, color, r }, i) => {
        const c = 2 * Math.PI * r;
        return (
          <g key={color}>
            <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeOpacity={0.18} strokeWidth={12} fill="none" />
            <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={12} fill="none" strokeLinecap="round" className="animate-ring" style={ringStyle(c, value, i * 150)} />
          </g>
        );
      })}
    </svg>
  );
}

/** Pas des 7 derniers jours (barres), objectif en pointillé. */
export function StepsBars({ days, goal }: { days: { date: string; steps: number | null }[]; goal: number }) {
  const max = Math.max(goal * 1.2, ...days.map((d) => d.steps ?? 0));
  return (
    <div className="relative">
      <div className="absolute inset-x-0 border-t border-dashed border-accent/50" style={{ bottom: `${(goal / max) * 64 + 16}px` }} />
      <div className="flex items-end gap-1.5">
        {days.map((d, i) => (
          <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-16 w-full items-end">
              <div
                style={{ height: `${Math.max(4, ((d.steps ?? 0) / max) * 64)}px`, animationDelay: `${i * 50}ms` }}
                className={`animate-grow-y w-full rounded-md ${(d.steps ?? 0) >= goal ? "bg-accent" : "bg-surface-2"}`}
                title={`${d.steps ?? "—"} pas`}
              />
            </div>
            <span className="text-[10px] text-muted">{fmtDate(d.date, { weekday: "narrow", day: undefined, month: undefined })}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
