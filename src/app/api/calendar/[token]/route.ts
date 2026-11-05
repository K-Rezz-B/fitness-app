import { getPlans, listProfiles } from "@/lib/data";
import { buildCalendar } from "@/lib/ics";
import { profileIdFromCalendarToken } from "@/lib/auth";
import { TZ } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Flux iCalendar abonnable (Apple Calendrier), un par profil. Protégé par jeton secret dans l'URL. */
export async function GET(req: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const pid = await profileIdFromCalendarToken(token.replace(/\.ics$/, ""));
  const owner = pid ? (await listProfiles()).find((p) => p.id === pid) : undefined;
  if (!owner) return new Response("Not found", { status: 404 });
  const origin = new URL(req.url).origin;
  return new Response(buildCalendar(await getPlans(owner.id), TZ, origin, owner.name), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="fitpulse.ics"',
      "Cache-Control": "no-store",
    },
  });
}
