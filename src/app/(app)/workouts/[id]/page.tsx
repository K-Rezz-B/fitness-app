import { notFound } from "next/navigation";
import { getWeights, getVideos, getWorkout } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { WorkoutForm } from "@/components/workout-form";
import { deleteWorkout } from "@/app/actions";

export default async function EditWorkout({ params }: PageProps<"/workouts/[id]">) {
  const { id } = await params;
  const [w, videos, ws] = await Promise.all([getWorkout(Number(id) || 0), getVideos(), getWeights()]);
  if (!w) notFound();
  return (
    <>
      <PageHeader
        title="Modifier la séance"
        action={
          <form action={deleteWorkout}>
            <input type="hidden" name="id" value={w.id} />
            <button className="btn-ghost text-critical">Supprimer</button>
          </form>
        }
      />
      <WorkoutForm initial={{ ...w, date: w.date.toISOString() }} videos={videos.map((v) => ({ id: v.id, title: v.title }))} weightKg={ws[0]?.weightKg} />
    </>
  );
}
