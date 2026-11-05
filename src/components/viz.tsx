import { CATEGORIES, type Category } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";

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
          strokeDasharray={`${(c * score) / 100} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-4xl font-bold tabular-nums">{score}</span>
        <span className="text-[11px] text-ink-2">{label}</span>
      </div>
    </div>
  );
}

/** Heatmap d'activité (rampe séquentielle bleue, une seule teinte) */
const STEPS = ["#1f1f22", "#184f95", "#256abf", "#3987e5", "#86b6ef"];
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
        {weeks.map((w) => (
          <div key={w[0].day} className="grid grid-rows-7 gap-[3px]">
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
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
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
            <div className="font-mono text-lg font-semibold tabular-nums">{Math.round((s.minutes / total) * 100)} %</div>
            <div className="font-mono text-xs text-muted tabular-nums">{s.minutes} min</div>
          </div>
        ))}
      </div>
    </div>
  );
}
