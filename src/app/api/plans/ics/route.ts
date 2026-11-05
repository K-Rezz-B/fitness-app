import { cookies } from "next/headers";
import { getPlans } from "@/lib/data";
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
  const plans = (await getPlans(me.id)).filter((p) => !id || p.id === id);
  return new Response(buildCalendar(plans, TZ, new URL(req.url).origin, me.name), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="fitpulse${id ? `-${id}` : ""}.ics"`,
      "Cache-Control": "no-store",
    },
  });
}
