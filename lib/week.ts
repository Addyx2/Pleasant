// Week helpers. Agency weeks run Monday–Sunday ("Week Commencing (Monday)").

export function startOfDayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Returns the Monday of the week containing the given date. */
export function mondayOf(date: Date): Date {
  const d = startOfDayLocal(date);
  const offset = (d.getDay() + 6) % 7; // Monday -> 0 … Sunday -> 6
  d.setDate(d.getDate() - offset);
  return d;
}

export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function parseISODate(value: string | undefined | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function weekdayName(day: number): string {
  return WEEKDAY_NAMES[((day % 7) + 7) % 7] ?? "";
}

export interface PayCycle {
  cutoffWeekday: number; // 0 = Sunday … 6 = Saturday
  cutoffTime: string; // "HH:MM"
  payWeekday: number;
}

/** Next submission deadline strictly after `from` (e.g. Monday 4pm). */
export function nextCutoff(cycle: PayCycle, from = new Date()): Date {
  const [hours, minutes] = cycle.cutoffTime.split(":").map(Number);
  const candidate = startOfDayLocal(from);
  const delta = (cycle.cutoffWeekday - candidate.getDay() + 7) % 7;
  candidate.setDate(candidate.getDate() + delta);
  candidate.setHours(Number.isFinite(hours) ? hours : 16, Number.isFinite(minutes) ? minutes : 0, 0, 0);
  if (candidate <= from) candidate.setDate(candidate.getDate() + 7);
  return candidate;
}

/** Pay day (e.g. Friday) for the week of the given cutoff. */
export function payDayForCutoff(cycle: PayCycle, cutoff: Date): Date {
  const pay = startOfDayLocal(cutoff);
  const delta = (cycle.payWeekday - pay.getDay() + 7) % 7;
  pay.setDate(pay.getDate() + delta);
  return pay;
}
