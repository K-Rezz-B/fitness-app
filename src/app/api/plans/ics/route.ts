import { cookies } from "next/headers";
import { getPlanMoves, getPlans, getWorkouts } from "@/lib/data";
import { calendarDetails } from "@/lib/coach-plan";
import { buildCalendar } from "@/lib/ics";
import { SESSION_COOKIE, isValidSession } from "@/lib/auth";
import { getActiveProfile } from "@/lib/session";
import { TZ } from "@/lib/constants";

/** Import ponctuel (.ics téléchargé) des séances du profil actif : événements natifs dans ton calendrier iCloud. */
export async function GET(req: Request) {
  if (!(await isValidSession((await cookies()).get(SESSION_COOKIE)?.value))) {
    return new Response("Unauthorized", { status: 401 });
  }
  const me = await getActiveProfile();
  if (!me) return new Response("Aucun profil sélectionné", { status: 409 });
  const id = Number(new URL(req.url).searchParams.get("id"));
  const [all, workouts, moves] = await Promise.all([getPlans(me.id), getWorkouts(me.id), getPlanMoves(me.id)]);
  const plans = all.filter((p) => !id || p.id === id);
  return new Response(buildCalendar(plans, TZ, new URL(req.url).origin, me.name, calendarDetails(me, plans, workouts), moves.filter((m) => !id || m.planId === id)), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="fitpulse${id ? `-${id}` : ""}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
