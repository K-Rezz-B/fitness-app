"use client";
// Graphiques génériques de la page « Mon évolution ». Les props sont sérialisables (données
// préparées côté serveur) : pas de fonctions de formatage, seulement unité + décimales.
import { useState } from "react";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { AXIS, Box, SURFACE } from "./charts";

const GRID = "#2a2a2e";
const MUTED = "#8a8984";
const compact = new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 });
const fmt = (v: number, decimals: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: decimals }).format(v);

export type SeriesDatum = { label: string; title: string; value: number | null; note?: string };

/** Axe « propre » autour des données (graduations 1-2-2,5-5 × 10ⁿ), sans partir de 0. */
function niceScale(values: number[], count = 4) {
  if (!values.length) return null;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const raw = (hi - lo || Math.abs(hi) * 0.1 || 1) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = ([1, 2, 2.5, 5, 10].find((m) => m * mag >= raw) ?? 10) * mag;
  const min = Math.max(lo >= 0 ? 0 : -Infinity, Math.floor(lo / step) * step - (lo % step === 0 ? step : 0));
  const max = Math.ceil(hi / step) * step + (hi % step === 0 ? step : 0);
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1000) / 1000);
  return { domain: [min, max] as [number, number], ticks };
}

function Legend({ items }: { items: { kind: "bar" | "dim" | "line" | "dash" | "band"; color?: string; label: string }[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          {it.kind === "bar" && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: it.color }} />}
          {it.kind === "dim" && <span className="h-2.5 w-2.5 rounded-sm opacity-40" style={{ background: it.color }} />}
          {it.kind === "line" && <span className="h-0.5 w-4 rounded-full" style={{ background: it.color }} />}
          {it.kind === "dash" && <span className="w-4 border-t border-dashed border-muted" />}
          {it.kind === "band" && <span className="h-2.5 w-4 rounded-sm bg-good/25" />}
          {it.label}
        </span>
      ))}
    </div>
  );
}

function renderTip({ active, payload }: TooltipContentProps, name: string, unit: string, decimals: number, color: string) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload as SeriesDatum;
  return (
    <Box
      title={d.title}
      rows={[
        { label: name, value: d.value === null ? "—" : `${fmt(d.value, decimals)}${unit ? ` ${unit}` : ""}`, color },
        ...(d.note ? [{ label: d.note, value: "" }] : []),
      ]}
    />
  );
}

/** Barres d'une seule série ; avec un objectif, les barres qui ne l'atteignent pas sont atténuées. */
export function BarSeries({
  data,
  name,
  color,
  unit = "",
  decimals = 0,
  goal,
  goalLabel,
  height = 208,
}: {
  data: SeriesDatum[];
  name: string;
  color: string;
  unit?: string;
  decimals?: number;
  goal?: number | null;
  goalLabel?: string;
  height?: number;
}) {
  return (
    <div>
      {goal ? (
        <Legend
          items={[
            { kind: "bar", color, label: "Objectif atteint" },
            { kind: "dim", color, label: "En dessous" },
            { kind: "dash", label: goalLabel ?? `Objectif ${fmt(goal, decimals)} ${unit}` },
          ]}
        />
      ) : null}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="18%">
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={16} />
            <YAxis {...AXIS} width={40} tickFormatter={(v: number) => compact.format(v)} />
            {goal ? <ReferenceLine y={goal} stroke={MUTED} strokeDasharray="4 4" ifOverflow="extendDomain" /> : null}
            <Tooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={(p: TooltipContentProps) => renderTip(p, name, unit, decimals, color)} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive={false}>
              {data.map((d, i) => (
                <Cell key={i} fill={color} fillOpacity={goal && (d.value ?? 0) < goal ? 0.4 : 1} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Courbe d'une seule série (aire légère en option), avec zone de référence et seuils. */
export function LineSeries({
  data,
  name,
  color,
  unit = "",
  decimals = 0,
  domain,
  area = false,
  band,
  refs = [],
  height = 208,
}: {
  data: SeriesDatum[];
  name: string;
  color: string;
  unit?: string;
  decimals?: number;
  domain?: [number, number];
  area?: boolean;
  band?: { from: number; to: number; label: string };
  refs?: { y: number; label: string }[];
  height?: number;
}) {
  const scale = domain ? null : niceScale(data.map((d) => d.value).filter((v): v is number => v !== null));
  const dots = data.length <= 40;
  const dot = dots ? { r: 4, fill: color, stroke: SURFACE, strokeWidth: 2 } : false;
  const legend = [
    ...(band ? [{ kind: "band" as const, label: band.label }] : []),
    ...refs.map((r) => ({ kind: "dash" as const, label: r.label })),
  ];
  return (
    <div>
      {legend.length > 0 && <Legend items={legend} />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...AXIS} width={40} domain={domain ?? scale?.domain} ticks={scale?.ticks} tickFormatter={(v: number) => compact.format(v)} allowDecimals={decimals > 0} />
            {band ? <ReferenceArea y1={band.from} y2={band.to} fill="#0ca30c" fillOpacity={0.12} ifOverflow="extendDomain" /> : null}
            {refs.map((r) => (
              <ReferenceLine key={r.label} y={r.y} stroke={MUTED} strokeDasharray="4 4" ifOverflow="extendDomain" />
            ))}
            <Tooltip cursor={{ stroke: MUTED, strokeWidth: 1 }} content={(p: TooltipContentProps) => renderTip(p, name, unit, decimals, color)} />
            {area ? (
              <Area dataKey="value" type="monotone" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.1} dot={dot} activeDot={{ r: 6 }} isAnimationActive={false} />
            ) : (
              <Line dataKey="value" type="monotone" stroke={color} strokeWidth={2} dot={dot} activeDot={{ r: 6 }} isAnimationActive={false} />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type ExerciseSeriesProps = {
  key: string;
  name: string;
  metric: "e1rm" | "reps";
  points: { label: string; title: string; value: number; set: string; tonnage: number }[];
  best: { value: number; set: string; date: string };
};

/** Progression d'un exercice choisi : 1RM estimé (charges) ou meilleure série (poids du corps). */
export function ExerciseProgress({ series, color }: { series: ExerciseSeriesProps[]; color: string }) {
  const [key, setKey] = useState(series[0]?.key);
  const s = series.find((x) => x.key === key) ?? series[0];
  if (!s) return null;
  const unit = s.metric === "e1rm" ? "kg" : "reps";
  const first = s.points[0].value;
  const last = s.points[s.points.length - 1].value;
  const diff = last - first;
  const data: SeriesDatum[] = s.points.map((p) => ({
    label: p.label,
    title: p.title,
    value: p.value,
    note: s.metric === "e1rm" ? `${p.set} · ${fmt(p.tonnage, 0)} kg soulevés` : p.set,
  }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <select value={s.key} onChange={(e) => setKey(e.target.value)} aria-label="Exercice" className="input w-auto max-w-full py-1.5">
          {series.map((x) => (
            <option key={x.key} value={x.key}>
              {x.name} · {x.points.length} séance{x.points.length > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <div className="text-xs text-ink-2">
          Meilleure série <b className="font-mono text-ink">{s.best.set}</b>
          {s.points.length >= 2 && (
            <>
              {" "}· évolution{" "}
              <b className="font-mono text-ink">
                {diff > 0 ? "+" : diff < 0 ? "−" : "±"}
                {fmt(Math.abs(diff), 1)} {unit}
              </b>
              {first > 0 && <span className="text-muted"> ({diff >= 0 ? "+" : "−"}{Math.round(Math.abs(diff / first) * 100)} %)</span>}
            </>
          )}
        </div>
      </div>
      {s.points.length >= 2 ? (
        <LineSeries data={data} name={s.metric === "e1rm" ? "1RM estimé" : "Meilleure série"} color={color} unit={unit} decimals={1} />
      ) : (
        <p className="rounded-xl bg-surface-2 p-3 text-sm text-ink-2">
          Une seule séance sur la période ({s.points[0].title}) : la courbe apparaîtra dès la deuxième.
        </p>
      )}
      <details className="mt-3 text-xs">
        <summary className="cursor-pointer text-muted hover:text-ink-2">Voir les données</summary>
        <div className="mt-2 max-h-64 overflow-auto rounded-xl border border-line">
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-surface-2 text-muted">
              <tr>
                <th scope="col" className="px-3 py-1.5 font-medium">Séance</th>
                <th scope="col" className="px-3 py-1.5 font-medium">Meilleure série</th>
                <th scope="col" className="px-3 py-1.5 font-medium">{s.metric === "e1rm" ? "1RM estimé" : "Reps"}</th>
                {s.metric === "e1rm" && <th scope="col" className="px-3 py-1.5 font-medium">Tonnage</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {s.points.map((p, i) => (
                <tr key={i}>
                  <td className="px-3 py-1.5">{p.title}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{p.set}</td>
                  <td className="px-3 py-1.5 font-mono tabular-nums">{fmt(p.value, 1)}{s.metric === "e1rm" ? " kg" : ""}</td>
                  {s.metric === "e1rm" && <td className="px-3 py-1.5 font-mono tabular-nums">{fmt(p.tonnage, 0)} kg</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
