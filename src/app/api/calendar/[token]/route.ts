import { getPlans } from "@/lib/data";
import { buildCalendar } from "@/lib/ics";
import { safeEqual } from "@/lib/auth";
import { TZ } from "@/lib/constants";

export const dynamic = "force-dynamic";

/** Flux iCalendar abonnable (Apple Calendrier). Protégé par jeton secret dans l'URL. */
export async function GET(req: Request, ctx: RouteContext<"/api/calendar/[token]">) {
  const { token } = await ctx.params;
  const expected = process.env.CALENDAR_TOKEN;
  if (!expected || expected.length < 16 || !safeEqual(token.replace(/\.ics$/, ""), expected)) {
    return new Response("Not found", { status: 404 });
  }
  const origin = new URL(req.url).origin;
  return new Response(buildCalendar(await getPlans(), TZ, origin), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="fitpulse.ics"',
      "Cache-Control": "no-store",
    },
  });
}
