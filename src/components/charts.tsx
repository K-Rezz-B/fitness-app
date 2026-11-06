"use client";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";
import { CATEGORIES, type Category } from "@/lib/constants";

export const AXIS = { stroke: "#8a8984", fontSize: 11, tickLine: false, axisLine: false } as const;
export const SURFACE = "#161618";
const CATS = Object.keys(CATEGORIES) as Category[];

export function Box({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="rounded-xl border border-line bg-surface-2 px-3 py-2 text-xs shadow-xl">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2 text-ink-2">
          {r.color && <span className="h-2.5 w-2.5 rounded-sm" style={{ background: r.color }} />}
          <span>{r.label}</span>
          <span className="ml-auto pl-3 font-mono text-ink tabular-nums">{r.value}</span>
        </div>
      ))}
    </div>
  );
}

export type WeekDatum = { label: string; force: number; cardio: number; mobilite: number; sessions: number };

/** `average` : valeurs = moyenne par semaine (barres mensuelles de la page Évolution) */
export function WeeklyChart({ data, average = false }: { data: (WeekDatum & { title?: string })[]; average?: boolean }) {
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-2">
        {CATS.map((c) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: CATEGORIES[c].color }} />
            {CATEGORIES[c].label}
          </span>
        ))}
        <span className="flex items-center gap-1.5 text-muted">
          <span className="h-px w-4 border-t border-dashed border-muted" /> 150 min OMS
        </span>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#2a2a2e" />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" />
            <YAxis {...AXIS} width={36} />
            <ReferenceLine y={150} stroke="#8a8984" strokeDasharray="4 4" />
            <Tooltip
              cursor={{ fill: "rgba(255,255,255,0.04)" }}
              content={({ active, payload, label }: TooltipContentProps) =>
                active && payload?.length ? (
                  <Box
                    title={payload[0].payload.title ?? `Semaine du ${label}`}
                    rows={[
                      ...CATS.map((c) => ({
                        label: CATEGORIES[c].label,
                        value: `${payload[0].payload[c]} min`,
                        color: CATEGORIES[c].color,
                      })),
                      { label: average ? "Séances / sem." : "Séances", value: String(payload[0].payload.sessions).replace(".", ",") },
                    ]}
                  />
                ) : null
              }
            />
            {CATS.map((c, i) => (
              <Bar
                key={c}
                dataKey={c}
                stackId="a"
                fill={CATEGORIES[c].color}
                stroke={SURFACE}
                strokeWidth={2}
                radius={i === CATS.length - 1 ? [4, 4, 0, 0] : 0}
                animationDuration={700}
                animationBegin={i * 120}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export function WeightChart({ data, target }: { data: { label: string; weight: number; avg: number }[]; target?: number | null }) {
  const vals = data.flatMap((d) => [d.weight, d.avg]).concat(target ? [target] : []);
  const min = Math.floor(Math.min(...vals) - 1);
  const max = Math.ceil(Math.max(...vals) + 1);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#3987e5]/60" /> Pesée</span>
        <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> Moyenne 7 j</span>
        {target ? <span className="flex items-center gap-1.5 text-muted"><span className="w-4 border-t border-dashed border-muted" /> Objectif</span> : null}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2a2a2e" />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...AXIS} domain={[min, max]} width={36} />
            {target ? <ReferenceLine y={target} stroke="#8a8984" strokeDasharray="4 4" /> : null}
            <Tooltip
              cursor={{ stroke: "#8a8984", strokeWidth: 1 }}
              content={({ active, payload, label }: TooltipContentProps) =>
                active && payload?.length ? (
                  <Box
                    title={String(label)}
                    rows={[
                      { label: "Pesée", value: `${payload[0].payload.weight.toFixed(1)} kg`, color: "#3987e5" },
                      { label: "Moy. 7 j", value: `${payload[0].payload.avg.toFixed(1)} kg`, color: "#c6f432" },
                    ]}
                  />
                ) : null
              }
            />
            <Line dataKey="weight" stroke="transparent" dot={{ r: 4, fill: "#3987e5", fillOpacity: 0.6, stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            <Line dataKey="avg" stroke="#c6f432" strokeWidth={2} dot={false} type="monotone" animationDuration={1000} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

export type ExerciseDatum = { label: string; e1rm: number; maxWeight: number; maxReps: number };

/** Progression d'un exercice : 1RM estimé (ligne) + charge max (points), ou reps max pour le poids du corps. */
export function ExerciseChart({ data, bodyweight }: { data: ExerciseDatum[]; bodyweight: boolean }) {
  const key = bodyweight ? "maxReps" : "e1rm";
  const unit = bodyweight ? "reps" : "kg";
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-ink-2">
        {bodyweight ? (
          <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> Reps max par séance</span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-accent" /> 1RM estimé (Epley)</span>
            <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#9d7bff]" /> Charge max</span>
          </>
        )}
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="#2a2a2e" />
            <XAxis dataKey="label" {...AXIS} interval="preserveStartEnd" minTickGap={24} />
            <YAxis {...AXIS} width={36} domain={["auto", "auto"]} />
            <Tooltip
              cursor={{ stroke: "#8a8984", strokeWidth: 1 }}
              content={({ active, payload, label }: TooltipContentProps) =>
                active && payload?.length ? (
                  <Box
                    title={String(label)}
                    rows={
                      bodyweight
                        ? [{ label: "Reps max", value: String(payload[0].payload.maxReps), color: "#c6f432" }]
                        : [
                            { label: "1RM estimé", value: `${payload[0].payload.e1rm} kg`, color: "#c6f432" },
                            { label: "Charge max", value: `${payload[0].payload.maxWeight} kg`, color: "#9d7bff" },
                          ]
                    }
                  />
                ) : null
              }
            />
            {!bodyweight && (
              <Line dataKey="maxWeight" stroke="transparent" dot={{ r: 4, fill: "#9d7bff", stroke: SURFACE, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
            )}
            <Line dataKey={key} name={unit} stroke="#c6f432" strokeWidth={2.5} type="monotone" dot={{ r: 3, fill: "#c6f432", strokeWidth: 0 }} animationDuration={1000} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
