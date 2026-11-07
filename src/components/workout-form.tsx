"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, History, Play, Plus, RotateCcw, Trash2, Undo2, X } from "lucide-react";
import { useFormStatus } from "react-dom";
import clsx from "clsx";
import { WORKOUT_TYPES, typeInfo, CATEGORIES } from "@/lib/constants";
import type { Exercise, ExerciseSet, Workout } from "@/lib/schema";
import { saveWorkout } from "@/app/actions";
import type { CoachVideoResult, VideoPick } from "@/lib/video-coach";
import { exerciseKey, formatSets, isRecordSet, type ExerciseMemo } from "@/lib/records";
import { enqueueWorkout, isNetworkError } from "@/lib/outbox";
import { fmtDate } from "@/lib/dates";
import { CoachVideo } from "./coach-video";
import { LiveBar, RestTimer, clearDraft, draftSnapshot, parseDraft, readDraft, subscribeDraft, unlockAudio, writeDraft, type LiveDraft } from "./live-session";
import { buzz, confetti } from "./confetti";
import { Spinner } from "./forms";
import { toast } from "./toaster";

type Initial = Partial<Pick<Workout, "id" | "type" | "title" | "durationMin" | "rpe" | "distanceKm" | "calories" | "notes" | "videoId" | "exercises">> & { date?: string };
/** Dernière séance de chaque type, pour « refaire ma dernière séance ». */
export type LastWorkout = Pick<Workout, "title" | "durationMin" | "rpe" | "exercises"> & { date: string };

/** En séance en direct, chaque série peut être cochée (le serveur ignore ce champ). */
type FormSet = ExerciseSet & { done?: boolean };
type FormExercise = { name: string; sets: FormSet[] };
type DraftState = { type: string; title: string; rpe: number; exercises: FormExercise[] };

const RPE_LABELS = ["", "Très facile", "Facile", "Modéré", "Modéré+", "Soutenu", "Soutenu+", "Difficile", "Très difficile", "Extrême", "Max"];

function toLocalInput(d: Date) {
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

/** Vidéo du coach pré-sélectionnée comme « vidéo suivie » si c'est une vidéo guidée de la vidéothèque. */
const followed = (p?: VideoPick) => (p?.id && !p.cooldown ? String(p.id) : "");

const restUntil = (sec: number) => Date.now() + sec * 1000;

/** Séries de la dernière fois, sans les cases cochées. */
const copySets = (sets: ExerciseSet[]): FormSet[] => sets.map((s) => ({ reps: s.reps, weight: s.weight }));

/** Saisie au pouce : tout le contenu est sélectionné au toucher, on tape directement la nouvelle valeur. */
const selectAll = (e: { currentTarget: HTMLInputElement }) => e.currentTarget.select();

/** Bouton d'enregistrement : indicateur pendant l'envoi, impossible d'enregistrer deux fois. */
function SaveButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  const { pending } = useFormStatus();
  return (
    <button type={onClick ? "button" : "submit"} onClick={onClick} disabled={pending} aria-busy={pending} className="btn-primary w-full py-3.5 text-base">
      {pending ? (
        <>
          <Spinner size={18} /> Enregistrement…
        </>
      ) : (
        children
      )}
    </button>
  );
}

export function WorkoutForm({
  initial,
  videos,
  weightKg,
  coach,
  pid,
  memos = {},
  lastByType = {},
  autoLive = false,
}: {
  initial: Initial;
  videos: { id: number; title: string }[];
  weightKg?: number;
  coach?: CoachVideoResult;
  pid: number;
  memos?: Record<string, ExerciseMemo>;
  lastByType?: Record<string, LastWorkout>;
  /** Arrivée depuis « C'est parti » : la séance démarre en direct */
  autoLive?: boolean;
}) {
  const kg = weightKg ?? 75;
  const isNew = !initial.id;
  const formRef = useRef<HTMLFormElement>(null);
  const [videoId, setVideoId] = useState(() => (initial.videoId ? String(initial.videoId) : followed(coach?.picks[0])));
  const [type, setType] = useState(initial.type ?? "muscu");
  const [title, setTitle] = useState(initial.title ?? "");
  const [rpe, setRpe] = useState(initial.rpe ?? 6);
  const [duration, setDuration] = useState(initial.durationMin ?? 45);
  const [local, setLocal] = useState(() => toLocalInput(initial.date ? new Date(initial.date) : new Date()));
  const [exercises, setExercises] = useState<FormExercise[]>(initial.exercises ?? []);
  const [offlineSaved, setOfflineSaved] = useState(false);
  // Exercice tout juste ajouté (son nom prend le focus) et dernier supprimé (annulable quelques secondes)
  const [focusIdx, setFocusIdx] = useState<number | null>(null);
  const [removed, setRemoved] = useState<{ ex: FormExercise; i: number } | null>(null);
  useEffect(() => {
    if (!removed) return;
    const t = setTimeout(() => setRemoved(null), 6000);
    return () => clearTimeout(t);
  }, [removed]);
  const info = typeInfo(type);
  const iso = useMemo(() => (local ? new Date(local).toISOString() : ""), [local]);
  const last = isNew ? lastByType[type] : undefined;
  const known = Object.keys(memos).length;

  // ---- Séance en direct ----
  const [live, setLive] = useState<{ startedAt: number; restSec: number } | null>(null);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  // Séance en direct interrompue (rechargement, app fermée) : proposée à la reprise
  const draftRaw = useSyncExternalStore(subscribeDraft, () => (isNew ? draftSnapshot(pid) : null), () => null);
  const [draftDismissed, setDraftDismissed] = useState(false);
  const resumable = useMemo(() => (draftRaw && !draftDismissed ? parseDraft<DraftState>(draftRaw) : null), [draftRaw, draftDismissed]);
  const dismissDraft = () => {
    clearDraft(pid);
    setDraftDismissed(true);
  };

  const autoStarted = useRef(false);
  useEffect(() => {
    if (!autoLive || !isNew || autoStarted.current || readDraft(pid)) return;
    autoStarted.current = true;
    setLive({ startedAt: Date.now(), restSec: 90 });
  }, [autoLive, isNew, pid]);

  useEffect(() => {
    if (live) writeDraft<DraftState>(pid, { ...live, state: { type, title, rpe, exercises } });
  }, [live, pid, type, title, rpe, exercises]);

  const startLive = (from?: LiveDraft<DraftState>) => {
    unlockAudio();
    if (from) {
      setType(from.state.type);
      setTitle(from.state.title);
      setRpe(from.state.rpe);
      setExercises(from.state.exercises);
    }
    setLive({ startedAt: from?.startedAt ?? Date.now(), restSec: from?.restSec ?? 90 });
    setDraftDismissed(true);
    buzz(20);
  };
  const stopLive = () => {
    clearDraft(pid);
    setLive(null);
    setRest(null);
  };
  const finishLive = () => {
    if (!live) return;
    setDuration(Math.max(1, Math.round((Date.now() - live.startedAt) / 60_000)));
    setLocal(toLocalInput(new Date(live.startedAt)));
    setRest(null);
    setLive(null);
    // On laisse React appliquer durée et date avant d'envoyer
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  };
  const endRest = useCallback(() => setRest(null), []);

  const update = (i: number, fn: (e: FormExercise) => FormExercise) => setExercises((xs) => xs.map((e, j) => (j === i ? fn(e) : e)));
  const addExercise = () => {
    setFocusIdx(exercises.length);
    setExercises((x) => [...x, { name: "", sets: [{}] }]);
  };
  const removeExercise = (i: number) => {
    const ex = exercises[i];
    if (ex.name.trim() || ex.sets.some((s) => s.reps != null || s.weight != null)) setRemoved({ ex, i });
    setFocusIdx(null);
    setExercises((xs) => xs.filter((_, j) => j !== i));
  };
  const undoRemove = () => {
    if (!removed) return;
    setExercises((xs) => [...xs.slice(0, removed.i), removed.ex, ...xs.slice(removed.i)]);
    setRemoved(null);
  };
  const updateSet = (i: number, k: number, patch: Partial<FormSet>) => update(i, (x) => ({ ...x, sets: x.sets.map((y, m) => (m === k ? { ...y, ...patch } : y)) }));

  const toggleDone = (i: number, k: number) => {
    unlockAudio();
    const s = exercises[i].sets[k];
    updateSet(i, k, { done: !s.done });
    if (!s.done && live) {
      buzz(25);
      if (isRecordSet(memos[exerciseKey(exercises[i].name)], s)) confetti({ count: 80, duration: 1800 });
      setRest({ endsAt: restUntil(live.restSec), total: live.restSec });
    }
  };

  const repeatLast = () => {
    if (!last) return;
    setTitle(last.title);
    setDuration(last.durationMin);
    setRpe(last.rpe);
    setExercises(last.exercises.map((e) => ({ name: e.name, sets: copySets(e.sets) })));
    buzz(15);
    toast("Dernière séance reprise : ajuste et c'est parti", { kind: "info" });
  };

  const totalSets = exercises.reduce((n, e) => n + e.sets.length, 0);
  const doneSets = exercises.reduce((n, e) => n + e.sets.filter((s) => s.done).length, 0);
  const clean: Exercise[] = exercises.map((e) => ({ name: e.name, sets: e.sets.map(({ reps, weight }) => ({ reps, weight })) }));

  /** Enregistrement : direct si le réseau répond, sinon gardé sur l'appareil et envoyé plus tard. */
  const submit = async (fd: FormData) => {
    clearDraft(pid);
    if (isNew && !navigator.onLine) return keepOffline(fd);
    try {
      await saveWorkout(fd);
    } catch (e) {
      if (isNew && isNetworkError(e)) return keepOffline(fd);
      throw e;
    }
  };
  const keepOffline = (fd: FormData) => {
    enqueueWorkout(pid, fd);
    setOfflineSaved(true);
    setExercises([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (offlineSaved) {
    return (
      <div className="animate-pop card flex flex-col items-center py-12 text-center">
        <div className="text-5xl">📴</div>
        <div className="mt-3 font-semibold">Séance gardée sur ton téléphone</div>
        <p className="mt-2 max-w-sm text-sm text-muted">Pas de réseau pour l&apos;instant : elle sera envoyée automatiquement dès que la connexion revient.</p>
        <button type="button" onClick={() => setOfflineSaved(false)} className="btn-ghost mt-5">Saisir une autre séance</button>
      </div>
    );
  }

  return (
    <form ref={formRef} action={submit} className="space-y-4">
      {initial.id && <input type="hidden" name="id" value={initial.id} />}
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="date" value={iso} />
      <input type="hidden" name="exercises" value={JSON.stringify(clean)} />
      <datalist id="exercise-names">
        {Object.values(memos).map((m) => <option key={m.name} value={m.name} />)}
      </datalist>

      {resumable && !live && (
        <section className="animate-pop card flex flex-wrap items-center gap-3 border-accent/40 bg-accent/5">
          <div className="min-w-0 flex-1 text-sm">
            <b>Séance en cours</b>
            <div className="text-xs text-ink-2">
              Commencée à {new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(resumable.startedAt)} · {resumable.state.exercises.length} exercice(s)
            </div>
          </div>
          <button type="button" onClick={dismissDraft} className="btn-ghost px-3 py-1.5 text-xs">Abandonner</button>
          <button type="button" onClick={() => startLive(resumable)} className="btn-primary px-3 py-1.5 text-xs"><Play size={14} /> Reprendre</button>
        </section>
      )}

      {live ? (
        <LiveBar
          startedAt={live.startedAt}
          restSec={live.restSec}
          onRestSec={(s) => setLive({ ...live, restSec: s })}
          onFinish={finishLive}
          onCancel={stopLive}
          doneSets={doneSets}
          totalSets={totalSets}
        />
      ) : (
        isNew && !resumable && (
          <section className="card flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1 text-sm">
              <b>Tu t&apos;entraînes maintenant ?</b>
              <div className="text-xs text-ink-2">Chrono, minuteur de repos entre les séries et records en direct.</div>
            </div>
            <button type="button" onClick={() => startLive()} className="btn-primary"><Play size={16} fill="currentColor" /> Démarrer en direct</button>
          </section>
        )
      )}

      {coach && !live && <CoachVideo result={coach} onPick={(p) => setVideoId(followed(p))} />}

      <section className="card">
        <div className="label">Type de séance</div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          {WORKOUT_TYPES.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setType(t.id)}
              className={clsx(
                "rounded-2xl border px-2 py-3 text-center text-xs font-medium transition active:scale-95",
                type === t.id ? "border-accent bg-accent/10 text-ink" : "border-line bg-surface-2 text-ink-2",
              )}
            >
              <div className={clsx("text-2xl transition-transform duration-300", type === t.id && "scale-125")}>{t.emoji}</div>
              <div className="mt-1 leading-tight">{t.label}</div>
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          Catégorie : <span style={{ color: CATEGORIES[info.category].color }}>●</span> {CATEGORIES[info.category].label}
        </p>
        {last && (
          <button type="button" onClick={repeatLast} className="animate-fade-up mt-3 flex w-full items-center gap-3 rounded-2xl border border-dashed border-line bg-surface-2 px-4 py-3 text-left text-sm transition hover:border-accent active:scale-[.99]">
            <RotateCcw size={18} className="shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <b>Refaire ma dernière séance</b>
              <span className="block truncate text-xs text-ink-2">
                {last.title} · {fmtDate(last.date)} · {last.durationMin} min{last.exercises.length ? ` · ${last.exercises.length} exercice(s)` : ""}
              </span>
            </span>
          </button>
        )}
      </section>

      <section className="card grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="title">Titre</label>
          <input id="title" name="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={info.label} className="input" />
        </div>
        {!live && (
          <>
            <div>
              <label className="label" htmlFor="dt">Date & heure</label>
              <input id="dt" type="datetime-local" value={local} onChange={(e) => setLocal(e.target.value)} className="input" required />
            </div>
            <div>
              <label className="label" htmlFor="durationMin">Durée (min)</label>
              <input id="durationMin" name="durationMin" type="number" inputMode="numeric" min={1} max={1440} value={duration} onFocus={selectAll} onChange={(e) => setDuration(Number(e.target.value))} className="input" required />
              <div className="mt-2 flex gap-1.5">
                {[20, 30, 45, 60, 90].map((m) => (
                  <button type="button" key={m} onClick={() => setDuration(m)} className={clsx("chip transition active:scale-95", duration === m && "border-accent text-accent")}>{m}</button>
                ))}
              </div>
            </div>
          </>
        )}
        {live && <input type="hidden" name="durationMin" value={duration} />}
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
          <button type="button" className="btn-ghost px-3 py-1.5 text-xs" onClick={addExercise}>
            <Plus size={14} /> Exercice
          </button>
        </div>
        {removed && (
          <div role="status" className="animate-fade-up mb-3 flex items-center gap-2 rounded-2xl border border-line bg-surface-2 px-3 py-2 text-sm">
            <span className="min-w-0 flex-1 truncate text-ink-2">« {removed.ex.name || "Exercice"} » supprimé</span>
            <button type="button" onClick={undoRemove} className="flex shrink-0 items-center gap-1 font-semibold text-accent active:scale-95">
              <Undo2 size={14} /> Annuler
            </button>
          </div>
        )}
        {exercises.length === 0 && (
          <p className="text-sm text-muted">
            Optionnel : détaille séries, reps et charges pour suivre ta progression{known ? " et battre tes records 🏆" : ""}.
          </p>
        )}
        <div className="space-y-3">
          {exercises.map((ex, i) => {
            const memo = memos[exerciseKey(ex.name)];
            return (
              <div key={i} className="animate-fade-up rounded-2xl border border-line bg-surface-2 p-3">
                <div className="flex gap-2">
                  <input value={ex.name} list="exercise-names" autoFocus={i === focusIdx} enterKeyHint="next" onChange={(e) => update(i, (x) => ({ ...x, name: e.target.value }))} placeholder="Nom de l'exercice" className="input bg-surface" />
                  <button type="button" aria-label="Supprimer l'exercice" onClick={() => removeExercise(i)} className="btn-ghost px-3">
                    <Trash2 size={16} />
                  </button>
                </div>
                {memo && (
                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-2">
                    <span className="inline-flex items-center gap-1">
                      <History size={12} className="text-muted" /> {fmtDate(memo.lastDate)} : <b className="font-mono">{formatSets(memo.lastSets)}</b>
                    </span>
                    <span className="text-muted">🏆 {memo.maxWeight > 0 ? `${memo.maxWeight} kg` : `${memo.maxReps} reps`}</span>
                    <button type="button" onClick={() => update(i, (x) => ({ ...x, sets: copySets(memo.lastSets) }))} className="font-medium text-accent">
                      Reprendre
                    </button>
                  </div>
                )}
                <div className="mt-2 space-y-1.5">
                  {ex.sets.map((s, k) => {
                    const pr = isRecordSet(memo, s);
                    return (
                      <div key={k} className={clsx("animate-fade-up flex items-center gap-2 rounded-xl text-sm transition-colors", s.done && "bg-accent/5")}>
                        {live ? (
                          <button
                            type="button"
                            onClick={() => toggleDone(i, k)}
                            aria-label={s.done ? `Série ${k + 1} faite` : `Valider la série ${k + 1}`}
                            aria-pressed={!!s.done}
                            className={clsx(
                              "grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition active:scale-90",
                              s.done ? "animate-pop border-accent bg-accent text-black" : "border-line bg-surface text-muted",
                            )}
                          >
                            {s.done ? <Check size={18} strokeWidth={3} /> : <span className="font-mono text-xs">S{k + 1}</span>}
                          </button>
                        ) : (
                          <span className="w-8 font-mono text-xs text-muted">S{k + 1}</span>
                        )}
                        <input type="number" inputMode="numeric" value={s.reps ?? ""} placeholder="reps" aria-label={`Répétitions série ${k + 1}`} onFocus={selectAll} onChange={(e) => updateSet(i, k, { reps: e.target.value === "" ? undefined : Number(e.target.value) })} className="input bg-surface py-1.5" />
                        <input type="number" inputMode="decimal" step="0.5" value={s.weight ?? ""} placeholder="kg" aria-label={`Charge série ${k + 1} (kg)`} onFocus={selectAll} onChange={(e) => updateSet(i, k, { weight: e.target.value === "" ? undefined : Number(e.target.value) })} className="input bg-surface py-1.5" />
                        {pr ? (
                          <span key="pr" className="animate-pop shrink-0 rounded-lg bg-warning/15 px-1.5 py-1 text-[10px] font-bold text-warning" title="Nouveau record">🏆 PR</span>
                        ) : (
                          <button type="button" aria-label="Retirer la série" onClick={() => update(i, (x) => ({ ...x, sets: x.sets.filter((_, m) => m !== k) }))} className="-m-1 p-1 text-muted transition active:scale-75"><X size={16} /></button>
                        )}
                      </div>
                    );
                  })}
                  <button type="button" onClick={() => update(i, (x) => ({ ...x, sets: [...x.sets, { reps: x.sets.at(-1)?.reps, weight: x.sets.at(-1)?.weight }] }))} className="rounded-lg py-1 pr-2 text-xs font-medium text-accent transition active:scale-95">+ série</button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <label className="label" htmlFor="notes">Notes / ressenti</label>
        <textarea id="notes" name="notes" rows={3} defaultValue={initial.notes ?? ""} placeholder="Sensations, douleurs…" className="input" />
      </section>

      {live ? (
        <SaveButton onClick={finishLive}>Terminer et enregistrer 🏁</SaveButton>
      ) : (
        <SaveButton>{initial.id ? "Mettre à jour" : "Enregistrer la séance 💪"}</SaveButton>
      )}

      {rest && <RestTimer endsAt={rest.endsAt} total={rest.total} onChange={(endsAt, total) => setRest({ endsAt, total })} onDone={endRest} />}
    </form>
  );
}
