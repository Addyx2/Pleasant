// Automation schedules are written in UK time ("weekdays at 07:30") but the
// server runs in UTC, so next-run times are computed in Europe/London,
// including the clock changes. Pure functions, unit tested.

export type Cadence = "DAILY" | "WEEKDAYS" | "WEEKLY";

export const CADENCE_LABELS: Record<Cadence, string> = {
  DAILY: "Every day",
  WEEKDAYS: "Weekdays",
  WEEKLY: "Weekly",
};

export const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const ZONE = "Europe/London";

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const formatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  weekday: "short",
  hourCycle: "h23",
});

const WEEKDAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function londonParts(date: Date): LocalParts {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((p) => [p.type, p.value]));
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAY_INDEX[parts.weekday],
  };
}

/** The UTC instant at which London's wall clock reads the given time. */
export function fromLondon(year: number, month: number, day: number, hour: number, minute: number): Date {
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  // London is UTC+0 or UTC+1; find the offset that maps back to the wall time.
  for (const offsetHours of [0, 1]) {
    const candidate = new Date(asUtc - offsetHours * 3_600_000);
    const p = londonParts(candidate);
    if (p.hour === hour && p.minute === minute && p.day === day) return candidate;
  }
  // The time doesn't exist (skipped by the spring clock change): run an hour later.
  return new Date(asUtc);
}

export function parseTime(time: string): { hour: number; minute: number } | null {
  const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time);
  return m ? { hour: Number(m[1]), minute: Number(m[2]) } : null;
}

function runsOn(cadence: Cadence, weekday: number | null, day: number): boolean {
  if (cadence === "DAILY") return true;
  if (cadence === "WEEKDAYS") return day >= 1 && day <= 5;
  return day === (weekday ?? 1);
}

/** The first scheduled time strictly after `from`. */
export function nextRun(cadence: Cadence, weekday: number | null, time: string, from: Date): Date {
  const t = parseTime(time) ?? { hour: 7, minute: 0 };
  const today = londonParts(from);
  const base = Date.UTC(today.year, today.month - 1, today.day);
  for (let i = 0; i <= 8; i++) {
    const d = new Date(base + i * 86_400_000);
    const weekdayOfD = d.getUTCDay();
    if (!runsOn(cadence, weekday, weekdayOfD)) continue;
    const at = fromLondon(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), t.hour, t.minute);
    if (at > from) return at;
  }
  throw new Error("No run found within 8 days");
}

export function describeSchedule(cadence: Cadence, weekday: number | null, time: string): string {
  if (cadence === "WEEKLY") return `Every ${WEEKDAY_NAMES[weekday ?? 1]} at ${time}`;
  return `${CADENCE_LABELS[cadence]} at ${time}`;
}
