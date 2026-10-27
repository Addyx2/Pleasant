export type RotaLineInput = {
  weekday: number;
  role: string;
  title: string;
  startMins: number;
  endMins: number;
  breakMins: number;
  isSleepIn: boolean;
  sleepInRate: number;
  chargeRate: number;
  clientId: string | null;
  staffId: string | null;
  siteId: string | null;
};

export type WeekDate = {
  /** Calendar date (midnight local) for the Monday-based week being generated. */
  start: Date;
  /** One entry per day of the week, Monday first. */
  days: { weekday: number; date: Date }[];
};

export function parseHhMm(value: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatHhMm(mins: number): string {
  const hours = Math.floor(mins / 60);
  const minutes = mins % 60;
  return `${`${hours}`.padStart(2, "0")}:${`${minutes}`.padStart(2, "0")}`;
}

export function buildWeek(start: Date): WeekDate {
  const base = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  // JS getDay() is 0=Sunday; templates use the same 0=Sunday convention,
  // so the raw weekday is preserved and Monday is found by offset.
  const dayOfWeek = base.getDay();
  const offsetToMonday = (dayOfWeek + 6) % 7;
  const monday = new Date(base);
  monday.setDate(base.getDate() - offsetToMonday);

  const days: { weekday: number; date: Date }[] = [];
  for (let i = 0; i < 7; i += 1) {
    const date = new Date(monday);
    date.setDate(monday.getDate() + i);
    // 0=Sunday … 6=Saturday
    days.push({ weekday: (i + 1) % 7, date });
  }
  return { start: monday, days };
}

export function isValidLine(line: Pick<RotaLineInput, "startMins" | "endMins" | "role" | "title">): boolean {
  if (!line.role?.trim() || !line.title?.trim()) return false;
  // An end clock earlier than the start means the shift runs into the next
  // day (lineEndFor rolls it forward), so measure it across midnight.
  const duration =
    line.endMins > line.startMins
      ? line.endMins - line.startMins
      : line.endMins + 24 * 60 - line.startMins;
  if (duration <= 0) return false;
  if (duration > 16 * 60) return false;
  return true;
}

export function lineDateFor(line: { weekday: number; startMins: number }, day: Date): Date {
  const date = new Date(day);
  date.setHours(Math.floor(line.startMins / 60), line.startMins % 60, 0, 0);
  return date;
}

export function lineEndFor(line: { startMins: number; endMins: number }, start: Date): Date {
  const end = new Date(start);
  end.setHours(Math.floor(line.endMins / 60), line.endMins % 60, 0, 0);
  // Overnight shift: end clock time is earlier than the start, so roll to tomorrow.
  if (end <= start) end.setDate(end.getDate() + 1);
  return end;
}

export function matchesWeekday(line: { weekday: number }, day: Date): boolean {
  return line.weekday === day.getDay();
}
