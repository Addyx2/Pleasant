import { shiftRateBand } from "./clients";
import { shiftDurationMins } from "./utils";

// What a carer earns for a shift, as the carer app shows it: their own rate for
// the shift's band (day, night, weekend, bank holiday), before tax.

interface Rates {
  baseRate: unknown;
  nightRate: unknown;
  weekendRate: unknown;
  bankHolidayRate: unknown;
}

const num = (v: unknown) => (v == null ? null : Number(v));

export function carerRate(profile: Rates, startAt: Date, endAt: Date, bankHolidays?: ReadonlySet<string>): number | null {
  const band = shiftRateBand(startAt, endAt, bankHolidays);
  const byBand = { DAY: num(profile.baseRate), NIGHT: num(profile.nightRate), WEEKEND: num(profile.weekendRate), BANK_HOLIDAY: num(profile.bankHolidayRate) }[band];
  return byBand ?? num(profile.baseRate);
}

/** Expected gross pay: the hourly rate times paid hours, or the flat allowance for a sleep-in. */
export function expectedPay(
  profile: Rates,
  shift: { startAt: Date; endAt: Date; breakMins: number; isSleepIn: boolean; sleepInRate: unknown },
  bankHolidays?: ReadonlySet<string>,
): { rate: number | null; total: number | null; hours: number } {
  const hours = Math.max(0, shiftDurationMins(shift.startAt, shift.endAt) - shift.breakMins) / 60;
  if (shift.isSleepIn) return { rate: null, total: Number(shift.sleepInRate), hours };
  const rate = carerRate(profile, shift.startAt, shift.endAt, bankHolidays);
  return { rate, total: rate == null ? null : Math.round(rate * hours * 100) / 100, hours };
}
