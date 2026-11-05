import type { Metadata } from "next";
import { getWeights, getVideos } from "@/lib/data";
import { templateById, templateToExercises } from "@/lib/templates";
import { TYPE_BY_ID } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { TemplatePicker } from "./picker";

export const metadata: Metadata = { title: "Nouvelle séance" };

export default async function NewWorkout({ searchParams }: PageProps<"/workouts/new">) {
  const [sp, videos, ws] = await Promise.all([searchParams, getVideos(), getWeights()]);
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const tpl = templateById(one(sp.template) ?? "");
  const type = one(sp.type);
  const initial = tpl
    ? { type: tpl.type, title: tpl.title, durationMin: tpl.durationMin, rpe: tpl.rpe, exercises: templateToExercises(tpl) }
    : {
        type: type && TYPE_BY_ID[type] ? type : undefined,
        title: one(sp.title),
        durationMin: Number(one(sp.duration)) || undefined,
      };
  return (
    <>
      <PageHeader title="Nouvelle séance" subtitle="Chaque séance loggée = XP + score 📈" />
      <TemplatePicker current={tpl?.id} />
      <WorkoutForm key={tpl?.id ?? type ?? "blank"} initial={initial} videos={videos.map((v) => ({ id: v.id, title: v.title }))} weightKg={ws[0]?.weightKg} />
    </>
  );
}
