import type { Metadata } from "next";
import { getPlan, getWeights, getVideos, getWorkouts } from "@/lib/data";
import { prescriptionFor, templatesForProfile } from "@/lib/coach-plan";
import { prescriptionToExercises } from "@/lib/planner";
import { requireProfile } from "@/lib/session";
import { templateById, templateToExercises } from "@/lib/templates";
import { TYPE_BY_ID } from "@/lib/constants";
import { today } from "@/lib/dates";
import { coachVideosFor } from "@/lib/video-coach";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { exerciseIndex, exerciseMemos } from "@/lib/records";
import type { LastWorkout } from "@/components/workout-form";
import { TemplatePicker } from "./picker";

export const metadata: Metadata = { title: "Nouvelle séance" };

export default async function NewWorkout({ searchParams }: PageProps<"/workouts/new">) {
  const me = await requireProfile();
  const pid = me.id;
  const [sp, videos, ws, history] = await Promise.all([searchParams, getVideos(pid), getWeights(pid), getWorkouts(pid)]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // Séance prévue par le coach : exercices + charges conseillées pré-remplis
  const plan = Number(one(sp.plan)) ? await getPlan(pid, Number(one(sp.plan))) : undefined;
  const rx = plan ? prescriptionFor(me, plan, history) : null;
  const tpl = templateById(one(sp.template) ?? plan?.templateId ?? "");
  const type = one(sp.type);
  const initial = plan && rx
    ? { type: plan.type, title: plan.title, durationMin: plan.durationMin, rpe: plan.rpe ?? tpl?.rpe, exercises: prescriptionToExercises(rx) }
    : tpl
    ? { type: tpl.type, title: tpl.title, durationMin: tpl.durationMin, rpe: tpl.rpe, exercises: templateToExercises(tpl) }
    : {
        type: type && TYPE_BY_ID[type] ? type : undefined,
        title: one(sp.title),
        durationMin: Number(one(sp.duration)) || undefined,
      };
  // Vidéo du coach pour le thème de la séance (programme, créneau du coach ou type choisi)
  const session = plan
    ? { templateId: plan.templateId, type: plan.type, durationMin: plan.durationMin }
    : initial.type
      ? { templateId: tpl?.id, type: initial.type, durationMin: initial.durationMin ?? 45 }
      : null;
  const coach = session ? coachVideosFor({ library: videos, session, profile: me, workouts: history, day: today() }) : undefined;
  // Historique pour « dernière fois », records en direct et « refaire ma dernière séance »
  const memos = exerciseMemos(exerciseIndex(history));
  const lastByType: Record<string, LastWorkout> = {};
  for (const w of history) // du plus récent au plus ancien
    lastByType[w.type] ??= { title: w.title, durationMin: w.durationMin, rpe: w.rpe, exercises: w.exercises, date: w.date.toISOString() };
  return (
    <>
      <PageHeader title="Nouvelle séance" subtitle={plan ? `🧠 Prévue par ton coach · ${plan.notes ?? ""}` : "Chaque séance loggée = XP + score 📈"} />
      {!plan && <TemplatePicker current={tpl?.id} doable={templatesForProfile(me).list} showAll={one(sp.all) === "1"} />}
      <WorkoutForm key={plan ? `plan-${plan.id}` : (tpl?.id ?? type ?? "blank")} initial={initial} videos={videos.map((v) => ({ id: v.id, title: v.title }))} weightKg={ws[0]?.weightKg} coach={coach} pid={pid} memos={memos} lastByType={lastByType} autoLive={one(sp.live) === "1"} />
    </>
  );
}
