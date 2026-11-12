/** All timestamps are stored as UTC. Wall-clock input/display uses APP_TIMEZONE. */
export const TZ = process.env.APP_TIMEZONE || "Africa/Nouakchott";
const LOCALE = "ar-u-nu-latn";

function offsetMs(utc: Date, tz: string): number {
  const p = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
    .formatToParts(utc)
    .reduce<Record<string, string>>((a, x) => ((a[x.type] = x.value), a), {});
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utc.getTime() / 1000) * 1000;
}

/** "2026-11-12T18:30" (wall time in tz) -> UTC Date. Returns null if malformed. */
export function zonedInputToUtc(value: string, tz = TZ): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value ?? "");
  if (!m) return null;
  const guess = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = guess - offsetMs(new Date(guess), tz);
  t = guess - offsetMs(new Date(t), tz); // second pass handles DST edges
  return new Date(t);
}

/** UTC Date -> "YYYY-MM-DDTHH:mm" wall time in tz for <input type="datetime-local">. */
export function utcToZonedInput(d: Date, tz = TZ): string {
  return new Date(d.getTime() + offsetMs(d, tz)).toISOString().slice(0, 16);
}

export const fmtDateTime = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, dateStyle: "medium", timeStyle: "short" }).format(d) : "—";
export const fmtDate = (d: Date | null | undefined) =>
  d ? new Intl.DateTimeFormat(LOCALE, { timeZone: TZ, dateStyle: "medium" }).format(d) : "—";
export const fmtNumber = (n: number) => new Intl.NumberFormat(LOCALE).format(n);
export const fmtPercent = (n: number | null) =>
  n == null ? "—" : `${new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 1 }).format(n)}%`;

/** Default window for a new activity form: starts tomorrow, 2h long, attendance opens 1h before and closes 1h after the end. */
export function defaultActivityWindow(now = new Date()) {
  const H = 3600_000,
    t = now.getTime();
  const f = (ms: number) => utcToZonedInput(new Date(t + ms));
  return { startsAt: f(24 * H), endsAt: f(26 * H), attendanceOpensAt: f(23 * H), attendanceClosesAt: f(27 * H) };
}

/** Suggested new registration deadline: one hour after the later of now and the current deadline. */
export function suggestedDeadline(current: Date, now = new Date()) {
  return utcToZonedInput(new Date(Math.max(now.getTime(), current.getTime()) + 3600_000));
}
