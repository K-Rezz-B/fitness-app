import type { Metadata } from "next";
import { getPlan, getWeights, getVideos, getWorkouts } from "@/lib/data";
import { prescriptionFor } from "@/lib/coach-plan";
import { prescriptionToExercises } from "@/lib/planner";
import { requireProfile } from "@/lib/session";
import { templateById, templateToExercises } from "@/lib/templates";
import { TYPE_BY_ID } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { TemplatePicker } from "./picker";

export const metadata: Metadata = { title: "Nouvelle séance" };

export default async function NewWorkout({ searchParams }: PageProps<"/workouts/new">) {
  const me = await requireProfile();
  const pid = me.id;
  const [sp, videos, ws] = await Promise.all([searchParams, getVideos(pid), getWeights(pid)]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  // Séance prévue par le coach : exercices + charges conseillées pré-remplis
  const plan = Number(one(sp.plan)) ? await getPlan(pid, Number(one(sp.plan))) : undefined;
  const rx = plan ? prescriptionFor(me, plan, await getWorkouts(pid)) : null;
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
  return (
    <>
      <PageHeader title="Nouvelle séance" subtitle={plan ? `🧠 Prévue par ton coach · ${plan.notes ?? ""}` : "Chaque séance loggée = XP + score 📈"} />
      {!plan && <TemplatePicker current={tpl?.id} />}
      <WorkoutForm key={plan ? `plan-${plan.id}` : (tpl?.id ?? type ?? "blank")} initial={initial} videos={videos.map((v) => ({ id: v.id, title: v.title }))} weightKg={ws[0]?.weightKg} />
    </>
  );
}
