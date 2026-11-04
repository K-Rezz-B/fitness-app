import { TZ } from "./constants";

const keyFmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" dans le fuseau de l'utilisateur */
export function dayKey(d: Date): string {
  return keyFmt.format(d);
}

/** Arithmétique sur des clés de jour (UTC pur, sans DST) */
export function keyToUTC(key: string): Date {
  return new Date(`${key}T00:00:00Z`);
}
export function addDays(key: string, n: number): string {
  const d = keyToUTC(key);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
/** 1 = lundi … 7 = dimanche */
export function isoWeekday(key: string): number {
  const w = keyToUTC(key).getUTCDay();
  return w === 0 ? 7 : w;
}
export function weekStart(key: string): string {
  return addDays(key, 1 - isoWeekday(key));
}
export function diffDays(a: string, b: string): number {
  return Math.round((keyToUTC(a).getTime() - keyToUTC(b).getTime()) / 86_400_000);
}
export function today(): string {
  return dayKey(new Date());
}

export function fmtDate(d: Date | string, opts: Intl.DateTimeFormatOptions = {}) {
  const date = typeof d === "string" ? (d.length === 10 ? keyToUTC(d) : new Date(d)) : d;
  const tz = typeof d === "string" && d.length === 10 ? "UTC" : TZ;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    ...opts,
  }).format(date);
}

export function fmtTime(d: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

export function hourInTZ(d: Date): number {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(d),
  );
}

export function ageFrom(birth: string | null | undefined): number | null {
  if (!birth) return null;
  const t = today();
  let age = Number(t.slice(0, 4)) - Number(birth.slice(0, 4));
  if (t.slice(5) < birth.slice(5)) age--;
  return age;
}
