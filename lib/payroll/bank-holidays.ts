// England & Wales bank holidays (the default for healthcare agencies).
// Source: GOV.UK bank holidays. Extend as new years are published.

const BANK_HOLIDAYS: Record<number, string[]> = {
  2025: [
    "2025-01-01",
    "2025-04-18",
    "2025-04-21",
    "2025-05-05",
    "2025-05-26",
    "2025-08-25",
    "2025-12-25",
    "2025-12-26",
  ],
  2026: [
    "2026-01-01",
    "2026-04-03",
    "2026-04-06",
    "2026-05-04",
    "2026-05-25",
    "2026-08-31",
    "2026-12-25",
    "2026-12-28",
  ],
  2027: [
    "2027-01-01",
    "2027-03-26",
    "2027-03-29",
    "2027-05-03",
    "2027-05-31",
    "2027-08-30",
    "2027-12-27",
    "2027-12-28",
  ],
};

function toKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

const lookup = new Set<string>(
  Object.values(BANK_HOLIDAYS).flat(),
);

export function isBankHoliday(date: Date): boolean {
  return lookup.has(toKey(date));
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}
