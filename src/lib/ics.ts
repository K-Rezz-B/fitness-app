import type { Plan } from "./schema";
import { typeInfo } from "./constants";
import { addDays, isoWeekday, today } from "./dates";

const BYDAY = ["", "MO", "TU", "WE", "TH", "FR", "SA", "SU"];

const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** Pliage RFC 5545 à 75 octets */
function fold(line: string): string {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let cur = "";
  let curLen = 0;
  for (const ch of line) {
    const l = new TextEncoder().encode(ch).length;
    if (curLen + l > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      curLen = 0;
    }
    cur += ch;
    curLen += l;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const local = (day: string, time: string) => `${day.replaceAll("-", "")}T${time.replace(":", "")}00`;

function endOf(day: string, time: string, minutes: number) {
  const [h, m] = time.split(":").map(Number);
  const total = h * 60 + m + minutes;
  const d = addDays(day, Math.floor(total / 1440));
  const r = total % 1440;
  return local(d, `${String(Math.floor(r / 60)).padStart(2, "0")}:${String(r % 60).padStart(2, "0")}`);
}

// RFC 5545 exige un VTIMEZONE pour chaque TZID. Fourni pour Europe/Paris,
// sinon heures « flottantes » (interprétées dans le fuseau de l'appareil).
const VTIMEZONES: Record<string, string[]> = {
  "Europe/Paris": [
    "BEGIN:VTIMEZONE", "TZID:Europe/Paris",
    "BEGIN:DAYLIGHT", "TZOFFSETFROM:+0100", "TZOFFSETTO:+0200", "TZNAME:CEST",
    "DTSTART:19700329T020000", "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU", "END:DAYLIGHT",
    "BEGIN:STANDARD", "TZOFFSETFROM:+0200", "TZOFFSETTO:+0100", "TZNAME:CET",
    "DTSTART:19701025T030000", "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU", "END:STANDARD",
    "END:VTIMEZONE",
  ],
};

export function buildCalendar(plans: Plan[], tz: string, appUrl?: string): string {
  const t = today();
  const vtz = VTIMEZONES[tz];
  const dt = (name: string, value: string) => (vtz ? `${name};TZID=${tz}:${value}` : `${name}:${value}`);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//FitPulse//Planning//FR",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:🏋️ Séances FitPulse",
    ...(vtz ? [`X-WR-TIMEZONE:${tz}`] : []),
    "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
    "X-PUBLISHED-TTL:PT1H",
    ...(vtz ?? []),
  ];
  for (const p of plans.filter((p) => p.active)) {
    // première occurrence ≥ aujourd'hui (en remontant d'une semaine pour garder l'événement du jour)
    const startFrom = addDays(t, -7);
    const offset = (p.weekday - isoWeekday(startFrom) + 7) % 7;
    const first = addDays(startFrom, offset);
    const info = typeInfo(p.type);
    lines.push(
      "BEGIN:VEVENT",
      `UID:plan-${p.id}@fitpulse`,
      `DTSTAMP:${stamp(p.updatedAt)}`,
      `LAST-MODIFIED:${stamp(p.updatedAt)}`,
      `SEQUENCE:${Math.floor(p.updatedAt.getTime() / 1000) % 2_000_000_000}`,
      dt("DTSTART", local(first, p.time)),
      dt("DTEND", endOf(first, p.time, p.durationMin)),
      `RRULE:FREQ=WEEKLY;BYDAY=${BYDAY[p.weekday]}`,
      `SUMMARY:${esc(`${info.emoji} ${p.title}`)}`,
      `DESCRIPTION:${esc(`Séance obligatoire · ${info.label} · ${p.durationMin} min${appUrl ? `\nLogger la séance : ${appUrl}/workouts/new?type=${p.type}` : ""}`)}`,
      ...(appUrl ? [`URL:${appUrl}/workouts/new?type=${p.type}`] : []),
      "CATEGORIES:Sport",
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
    );
    // Rappel avant + rappel à l'heure (séance « obligatoire »)
    for (const trig of [p.reminderMin > 0 ? `-PT${p.reminderMin}M` : null, "PT0M"].filter(Boolean)) {
      lines.push(
        "BEGIN:VALARM",
        "ACTION:DISPLAY",
        `DESCRIPTION:${esc(trig === "PT0M" ? `C'est l'heure : ${p.title} 💪` : `${p.title} dans ${p.reminderMin} min`)}`,
        `TRIGGER:${trig}`,
        "END:VALARM",
      );
    }
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
