"use client";
import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { WORKOUT_TYPES, typeInfo, CATEGORIES } from "@/lib/constants";
import type { Exercise, Workout } from "@/lib/schema";
import { saveWorkout } from "@/app/actions";
import type { CoachVideoResult, VideoPick } from "@/lib/video-coach";
import { CoachVideo } from "./coach-video";

type Initial = Partial<Pick<Workout, "id" | "type" | "title" | "durationMin" | "rpe" | "distanceKm" | "calories" | "notes" | "videoId" | "exercises">> & { date?: string };

const RPE_LABELS = ["", "Très facile", "Facile", "Modéré", "Modéré+", "Soutenu", "Soutenu+", "Difficile", "Très difficile", "Extrême", "Max"];

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/** Vidéo du coach pré-sélectionnée comme « vidéo suivie » si c'est une vidéo guidée de la vidéothèque. */
const followed = (p?: VideoPick) => (p?.id && !p.cooldown ? String(p.id) : "");

export function WorkoutForm({ initial, videos, weightKg, coach }: { initial: Initial; videos: { id: number; title: string }[]; weightKg?: number; coach?: CoachVideoResult }) {
  const kg = weightKg ?? 75;
  const [videoId, setVideoId] = useState(() => (initial.videoId ? String(initial.videoId) : followed(coach?.picks[0])));
  const [type, setType] = useState(initial.type ?? "muscu");
  const [rpe, setRpe] = useState(initial.rpe ?? 6);
  const [duration, setDuration] = useState(initial.durationMin ?? 45);
  const [local, setLocal] = useState(() => toLocalInput(initial.date ? new Date(initial.date) : new Date()));
  const [exercises, setExercises] = useState<Exercise[]>(initial.exercises ?? []);
  const info = typeInfo(type);
  const iso = useMemo(() => (local ? new Date(local).toISOString() : ""), [local]);

  const update = (i: number, fn: (e: Exercise) => Exercise) => setExercises((xs) => xs.map((e, j) => (j === i ? fn(e) : e)));

  return (
    <form action={saveWorkout} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="date" value={iso} />
      <input type="hidden" name="exercises" value={JSON.stringify(exercises)} />

      {coach && <CoachVideo result={coach} onPick={(p) => setVideoId(followed(p))} />}

      <section className="card">
        <div className="label">Type de séance</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {WORKOUT_TYPES.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setType(t.id)}
              className={`rounded-2xl border px-2 py-3 text-center text-xs font-medium transition ${
                type === t.id ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface-2 text-ink-2"
              }`}
            >
              <div className="text-2xl">{t.emoji}</div>
              <div className="mt-1 leading-tight">{t.label}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Catégorie : <span style={{ color: CATEGORIES[info.category].color }}>●</span> {CATEGORIES[info.category].label}
        </p>
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">Titre</label>
          <input id="title" name="title" defaultValue={initial.title ?? ""} placeholder={info.label} className="input" />
        </div>
        <div>
          <label className="label" htmlFor="dt">Date & heure</label>
          <input id="dt" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} className="input" required />
        </div>
        <div>
          <label className="label" htmlFor="durationMin">Durée (min)</label>
          <input id="durationMin" name="durationMin" type="number" inputMode="numeric" min={1} max={1440} value={duration} onChange={(e) => setDuration(Number(e.target.value))} className="input" required />
          <div className="mt-2 flex gap-1.5">
            {[20, 30, 45, 60, 90].map((m) => (
              <button type="button" key={m} onClick={() => setDuration(m)} className="chip">{m}</button>
            ))}
          </div>
        </div>
        <div className="sm:col-span-2">
          <label className="label" htmlFor="rpe">Effort perçu (RPE) : <span className="text-ink">{rpe}/10 · {RPE_LABELS[rpe]}</span></label>
          <input id="rpe" name="rpe" type="range" min={1} max={10} value={rpe} onChange={(e) => setRpe(Number(e.target.value))} className="w-full" />
          <p className="text-xs text-muted">Charge de séance : <b className="font-mono text-ink">{duration * rpe}</b> UA · ~{Math.round((info.met * 3.5 * kg * duration) / 200)} kcal (MET × {kg} kg)</p>
        </div>
        {info.hasDistance && (
          <div>
            <label className="label" htmlFor="distanceKm">Distance (km)</label>
            <input id="distanceKm" name="distanceKm" type="number" step="0.01" inputMode="decimal" defaultValue={initial.distanceKm ?? ""} className="input" />
          </div>
        )}
        <div>
          <label className="label" htmlFor="calories">Calories (montre)</label>
          <input id="calories" name="calories" type="number" inputMode="numeric" defaultValue={initial.calories ?? ""} placeholder="optionnel" className="input" />
        </div>
        {videos.length > 0 && (
          <div>
            <label className="label" htmlFor="videoId">Vidéo suivie</label>
            <select id="videoId" name="videoId" value={videoId} onChange={(e) => setVideoId(e.target.value)} className="input">
              <option value="">—</option>
              {videos.map((v) => <option key={v.id} value={v.id}>{v.title}</option>)}
            </select>
          </div>
        )}
      </section>

      <section className="card">
        <div className="mb-3 flex items-center justify-between">
          <div className="label mb-0">Exercices</div>
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={() => setExercises((x) => [...x, { name: "", sets: [{}] }])}>
            <Plus size={14} /> Exercice
          </button>
        </div>
        {exercises.length === 0 && <p className="text-sm text-muted">Optionnel : détaille séries, reps et charges pour suivre ta progression.</p>}
        <div className="space-y-3">
          {exercises.map((ex, i) => (
            <div key={i} className="rounded-2xl border border-line bg-surface-2 p-3">
              <div className="flex gap-2">
                <input value={ex.name} onChange={(e) => update(i, (x) => ({ ...x, name: e.target.value }))} placeholder="Nom de l'exercice" className="input bg-surface" />
                <button type="button" aria-label="Supprimer" onClick={() => setExercises((xs) => xs.filter((_, j) => j !== i))} className="btn-ghost px-3">
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="mt-2 space-y-1.5">
                {ex.sets.map((s, k) => (
                  <div key={k} className="flex items-center gap-2 text-sm">
                    <span className="w-8 font-mono text-xs text-muted">S{k + 1}</span>
                    <input type="number" inputMode="numeric" value={s.reps ?? ""} placeholder="reps" onChange={(e) => update(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, reps: e.target.value === "" ? undefined : Number(e.target.value) } : y)) }))} className="input bg-surface py-1.5" />
                    <input type="number" inputMode="decimal" step="0.5" value={s.weight ?? ""} placeholder="kg" onChange={(e) => update(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, weight: e.target.value === "" ? undefined : Number(e.target.value) } : y)) }))} className="input bg-surface py-1.5" />
                    <button type="button" aria-label="Retirer la série" onClick={() => update(i, (x) => ({ ...x, sets: x.sets.filter((_, m) => m !== k) }))} className="text-muted"><X size={16} /></button>
                  </div>
                ))}
                <button type="button" onClick={() => update(i, (x) => ({ ...x, sets: [...x.sets, { ...x.sets[x.sets.length - 1] }] }))} className="text-xs font-medium text-accent">+ série</button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="card">
        <label className="label" htmlFor="notes">Notes / ressenti</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} placeholder="Sensations, records, douleurs…" className="input" />
      </section>

      <button className="btn-primary w-full py-3.5 text-base">{initial.id ? "Mettre à jour" : "Enregistrer la séance 💪"}</button>
    </form>
  );
}
