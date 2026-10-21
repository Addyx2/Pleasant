// Client billing & margin.
//
// An invoice line is built from an approved (and client-authorised) timesheet.
// We bill the client at the shift's charge-out rate and cost the working margin
// against direct worker pay only — gross shift earnings at the worker's premium
// rates, statutory holiday accrual and any non-taxable expenses. Employer
// on-costs (NI & pension) and overheads are deliberately excluded from line
// margins; see the note rendered on the invoice detail page.

import { computeShiftEarnings, round2 } from "./payroll/engine";

export interface BillableTimesheet {
  id: string;
  breakMins: number;
  expenses: number;
  shift: {
    id: string;
    title: string;
    startAt: Date;
    endAt: Date;
    chargeRate: number;
    isSleepIn: boolean;
    /** Carer's flat sleep-in allowance (pay). */
    sleepInRate: number;
    /** Client's flat sleep-in charge; null/undefined bills the allowance. */
    sleepInCharge?: number | null;
  };
  staff: {
    id: string;
    baseRate: number;
    nightRate?: number | null;
    weekendRate?: number | null;
    bankHolidayRate?: number | null;
    holidayAccrualPct: number;
  };
}

export interface InvoiceLineCompute {
  timesheetId: string;
  shiftId: string;
  staffId: string;
  date: Date;
  title: string;
  hours: number;
  chargeRate: number;
  chargeAmount: number;
  payAmount: number;
  marginAmount: number;
}

export interface InvoiceTotals {
  hoursTotal: number;
  chargeTotal: number;
  payTotal: number;
  marginTotal: number;
  vatTotal: number;
  grandTotal: number;
}

/**
 * Computes one billable line from an approved timesheet, mirroring the payroll
 * engine's rounding so billable hours and worker pay agree with payslips.
 * Sleep-in shifts are billed as a flat allowance exactly as they are paid.
 */
export function computeInvoiceLine(
  ts: BillableTimesheet,
  roundingMins = 15,
): InvoiceLineCompute {
  const earnings = computeShiftEarnings({
    startAt: ts.shift.startAt,
    endAt: ts.shift.endAt,
    breakMins: ts.breakMins,
    rates: {
      baseRate: ts.staff.baseRate,
      nightRate: ts.staff.nightRate,
      weekendRate: ts.staff.weekendRate,
      bankHolidayRate: ts.staff.bankHolidayRate,
    },
    isSleepIn: ts.shift.isSleepIn,
    sleepInRate: ts.shift.sleepInRate,
    roundingMins,
  });

  const hours = round2(earnings.paidMins / 60);
  const pay = earnings.totalEarnings;
  const holiday = round2(pay * (ts.staff.holidayAccrualPct / 100));
  const expenses = round2(ts.expenses);

  const sleepInFlat = ts.shift.sleepInCharge ?? ts.shift.sleepInRate;
  const charge =
    ts.shift.isSleepIn && sleepInFlat > 0
      ? round2(sleepInFlat)
      : round2(ts.shift.chargeRate * hours);

  const payAmount = round2(pay + holiday + expenses);
  const marginAmount = round2(charge - payAmount);

  return {
    timesheetId: ts.id,
    shiftId: ts.shift.id,
    staffId: ts.staff.id,
    date: ts.shift.startAt,
    title: ts.shift.title,
    hours,
    chargeRate: ts.shift.chargeRate,
    chargeAmount: round2(charge),
    payAmount,
    marginAmount,
  };
}

/**
 * How an invoice line is priced, for display and accounting exports. Sleep-in
 * lines are a flat charge, so their hours and hourly rate aren't what the
 * client pays for; everything else is hours x hourly rate.
 */
export function lineBasis(line: {
  hours: number;
  chargeRate: number;
  chargeAmount: number;
  isSleepIn: boolean;
}): { flat: boolean; quantity: number; unitAmount: number; quantityLabel: string; rateLabel: string } {
  if (line.isSleepIn) {
    return {
      flat: true,
      quantity: 1,
      unitAmount: line.chargeAmount,
      quantityLabel: "Sleep-in",
      rateLabel: "Flat",
    };
  }
  return {
    flat: false,
    quantity: line.hours,
    unitAmount: line.chargeRate,
    quantityLabel: line.hours.toFixed(2),
    rateLabel: `£${line.chargeRate.toFixed(2)}/h`,
  };
}

export function invoiceTotals(
  lines: InvoiceLineCompute[],
  vatRatePct: number,
): InvoiceTotals {
  const hoursTotal = round2(lines.reduce((sum, l) => sum + l.hours, 0));
  const chargeTotal = round2(lines.reduce((sum, l) => sum + l.chargeAmount, 0));
  const payTotal = round2(lines.reduce((sum, l) => sum + l.payAmount, 0));
  const marginTotal = round2(lines.reduce((sum, l) => sum + l.marginAmount, 0));
  const vatTotal = round2(chargeTotal * (Math.max(0, vatRatePct) / 100));
  const grandTotal = round2(chargeTotal + vatTotal);
  return { hoursTotal, chargeTotal, payTotal, marginTotal, vatTotal, grandTotal };
}

export function defaultInvoiceReference(
  periodEnd: Date,
  sequence: number,
): string {
  const y = periodEnd.getFullYear();
  const m = String(periodEnd.getMonth() + 1).padStart(2, "0");
  return `INV-${y}${m}-${String(sequence).padStart(4, "0")}`;
}