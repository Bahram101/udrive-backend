// Kazakhstan is UTC+5 all year (no DST), so a fixed offset is exact.
const ALMATY_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

// Start of the Almaty calendar day containing `date`, shifted by `offsetDays`.
export function startOfAlmatyDay(date: Date, offsetDays = 0): Date {
  const localMs = date.getTime() + ALMATY_OFFSET_MS;
  const startMs = Math.floor(localMs / DAY_MS) * DAY_MS - ALMATY_OFFSET_MS;
  return new Date(startMs + offsetDays * DAY_MS);
}

// Monday 00:00 (Almaty) of the week containing `date`.
export function startOfAlmatyWeek(date: Date): Date {
  const today = startOfAlmatyDay(date);
  const weekday = new Date(today.getTime() + ALMATY_OFFSET_MS).getUTCDay();
  const daysSinceMonday = (weekday + 6) % 7;
  return startOfAlmatyDay(today, -daysSinceMonday);
}

export function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

export function almatyDayStartFromDateString(value: string): Date {
  return new Date(Date.parse(`${value}T00:00:00Z`) - ALMATY_OFFSET_MS);
}

// Start of the Almaty calendar month containing `date`.
export function startOfAlmatyMonth(date: Date): Date {
  const local = new Date(date.getTime() + ALMATY_OFFSET_MS);
  const startMs =
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - ALMATY_OFFSET_MS;
  return new Date(startMs);
}

// Format Date as "YYYY-MM-DD" in Almaty calendar date.
export function formatAlmatyDate(date: Date): string {
  const local = new Date(date.getTime() + ALMATY_OFFSET_MS);
  const y = local.getUTCFullYear();
  const m = String(local.getUTCMonth() + 1).padStart(2, "0");
  const d = String(local.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Converts optional Almaty "YYYY-MM-DD" range to UTC boundaries:
// from -> gte start of from-day; to -> lt start of next day after to-day.
export function almatyDateRangeToUtc(
  from?: string,
  to?: string,
): { gte?: Date; lt?: Date } | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from && { gte: almatyDayStartFromDateString(from) }),
    ...(to && { lt: startOfAlmatyDay(almatyDayStartFromDateString(to), 1) }),
  };
}
