// Briques serveur de la page « Mon évolution » : carte de graphique (+ tableau des données),
// variation vs période précédente, classement des activités, grille jour × créneau.
import { Fragment, type ReactNode } from "react";
import clsx from "clsx";
import { CATEGORIES, WEEKDAYS, type Category } from "@/lib/constants";
import { TIME_BANDS, type TypeShare } from "@/lib/evolution";
import { STEPS } from "./viz";

const nf = (v: number, decimals = 0) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(v);

/** 95 → « 1 h 35 », 40 → « 40 min » */
export const fmtMinutes = (m: number) => (m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${String(m % 60).padStart(2, "0")}` : ""}`);

export type Table = { head: string[]; rows: (string | number)[][] };

export function ChartCard({
  title,
  subtitle,
  aside,
  table,
  className,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  aside?: ReactNode;
  table?: Table;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={clsx("card min-w-0", className)}>
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
        </div>
        {aside && <div className="shrink-0 text-right">{aside}</div>}
      </div>
      {children}
      {table && table.rows.length > 0 && (
        <details className="mt-3 text-xs">
          <summary className="cursor-pointer text-muted hover:text-ink-2">Voir les données</summary>
          <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line">
            <table className="w-full text-left">
              <thead className="sticky top-0 bg-surface-2 text-muted">
                <tr>
                  {table.head.map((h) => (
                    <th key={h} scope="col" className="px-3 py-1.5 font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {table.rows.map((r, i) => (
                  <tr key={i}>
                    {r.map((c, j) => (
                      <td key={j} className={clsx("px-3 py-1.5 whitespace-nowrap", j > 0 && "font-mono tabular-nums")}>
                        {typeof c === "number" ? nf(c, 1) : c}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      )}
    </section>
  );
}

/** Valeur en tête de carte (étiquette directe de la dernière valeur) */
export function Headline({ value, unit, sub }: { value: ReactNode; unit?: string; sub?: ReactNode }) {
  return (
    <>
      <div className="text-2xl font-semibold">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </div>
      {sub && <div className="text-[11px] text-ink-2">{sub}</div>}
    </>
  );
}

/**
 * Variation entre deux valeurs. La flèche porte le sens (vert = bonne direction, rouge = mauvaise,
 * neutre si `goodWhenUp` est null) ; le texte reste en encre secondaire pour la lisibilité.
 */
export function Delta({
  cur,
  prev,
  goodWhenUp = true,
  unit = "",
  decimals = 0,
  suffix = "vs période préc.",
}: {
  cur: number | null;
  prev: number | null | undefined;
  goodWhenUp?: boolean | null;
  unit?: string;
  decimals?: number;
  suffix?: string;
}) {
  if (cur === null || prev === null || prev === undefined) return null;
  const d = cur - prev;
  if (Math.abs(d) < 0.5 / 10 ** decimals) return <span className="text-ink-2">= stable <span className="text-muted">{suffix}</span></span>;
  const up = d > 0;
  const pctValue = prev > 0 ? Math.round(Math.abs(d / prev) * 100) : null;
  // moins de 1 % d'écart : pas de flèche, c'est du bruit
  if (pctValue === 0) return <span className="text-ink-2">= stable <span className="text-muted">{suffix}</span></span>;
  const good = goodWhenUp === null ? null : up === goodWhenUp;
  const pct = pctValue !== null && pctValue < 1000 ? ` (${up ? "+" : "−"}${pctValue} %)` : "";
  return (
    <span className="text-ink-2">
      <span aria-hidden className={good === null ? "text-ink-2" : good ? "text-good" : "text-critical"}>{up ? "▲" : "▼"}</span>{" "}
      <span className="sr-only">{up ? "hausse" : "baisse"}{good === null ? "" : good ? " (bon signe)" : " (à surveiller)"} :</span>
      {up ? "+" : "−"}
      {nf(Math.abs(d), decimals)}
      {unit}
      {pct} <span className="text-muted">{suffix}</span>
    </span>
  );
}

/** Activités classées par temps passé, colorées par catégorie (Force / Cardio / Mobilité). */
export function TypeBars({ types }: { types: TypeShare[] }) {
  const max = Math.max(1, ...types.map((t) => t.minutes));
  const total = types.reduce((s, t) => s + t.minutes, 0);
  const cats = (Object.keys(CATEGORIES) as Category[]).filter((c) => types.some((t) => t.category === c));
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-2">
        {cats.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORIES[c].color }} />
            {CATEGORIES[c].label}
          </span>
        ))}
      </div>
      <ul className="space-y-2.5">
        {types.map((t) => (
          <li key={t.type}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
              <span className="truncate">{t.emoji} {t.label}</span>
              <span className="shrink-0 font-mono text-ink-2 tabular-nums">
                {fmtMinutes(t.minutes)} · {t.sessions} séance{t.sessions > 1 ? "s" : ""} · {Math.round((t.minutes / Math.max(1, total)) * 100)} %
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-surface-2">
              <div className="h-full rounded-full" style={{ width: `${Math.max(2, (t.minutes / max) * 100)}%`, background: CATEGORIES[t.category].color }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Nombre de séances par jour de la semaine × créneau horaire (rampe séquentielle bleue). */
export function WhenGrid({ grid }: { grid: number[][] }) {
  const max = Math.max(1, ...grid.flat());
  const level = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  return (
    <div>
      <div className="grid grid-cols-[auto_repeat(6,minmax(0,1fr))] gap-1 text-[10px] text-muted">
        <span />
        {TIME_BANDS.map((b) => (
          <span key={b.label} className="pb-1 text-center leading-tight">{b.label}</span>
        ))}
        {WEEKDAYS.map((d, i) => (
          <Fragment key={d}>
            <span className="flex items-center pr-1">{d.slice(0, 3)}</span>
            {grid[i].map((n, j) => {
              const label = `${d} ${TIME_BANDS[j].label.toLowerCase()} : ${n} séance${n > 1 ? "s" : ""}`;
              return (
                <div
                  key={j}
                  role="img"
                  aria-label={label}
                  title={label}
                  className="h-7 rounded-md transition hover:ring-1 hover:ring-ink-2"
                  style={{ background: STEPS[level(n)] }}
                />
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] text-muted">
        0 {STEPS.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-[2px]" style={{ background: c }} />)} {max} séance{max > 1 ? "s" : ""}
      </div>
    </div>
  );
}
