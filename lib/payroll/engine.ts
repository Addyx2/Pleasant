import { isBankHoliday, isWeekend } from "./bank-holidays";
import {
  getTaxYearConfig,
  taxYearFor,
  type StudentLoanPlan,
  type TaxYear,
  type TaxYearConfig,
} from "./rates";

export type PayPeriod = "WEEKLY" | "FORTNIGHTLY" | "FOUR_WEEKLY" | "MONTHLY";

export const PERIODS_PER_YEAR: Record<PayPeriod, number> = {
  WEEKLY: 52,
  FORTNIGHTLY: 26,
  FOUR_WEEKLY: 13,
  MONTHLY: 12,
};

export function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function clampMin(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// ---------------------------------------------------------------------------
// Income tax / tax codes
// ---------------------------------------------------------------------------

export interface TaxCodeInfo {
  allowance: number;
  flatRate: number | null; // BR / D0 / D1 / NT
}

/**
 * Parses a UK tax code into an annual allowance and/or flat rate.
 * Supports numeric codes (1257L, 1250L, 0T), suffix codes (L/M/N/T),
 * K codes, and the flat-rate specials BR / D0 / D1 / NT.
 */
export function parseTaxCode(code: string, config: TaxYearConfig): TaxCodeInfo {
  const clean = (code || "").trim().toUpperCase();

  if (clean === "NT") return { allowance: Infinity, flatRate: 0 };
  if (clean === "BR") return { allowance: 0, flatRate: 0.2 };
  if (clean === "D0") return { allowance: 0, flatRate: 0.4 };
  if (clean === "D1") return { allowance: 0, flatRate: 0.45 };
  if (clean === "0T") return { allowance: 0, flatRate: null };

  const match = clean.match(/^([0-9]+)([LMNT])?$/);
  if (match) {
    return { allowance: Number(match[1]) * 10, flatRate: null };
  }

  const kMatch = clean.match(/^K([0-9]+)$/);
  if (kMatch) {
    // K codes add to taxable pay rather than granting an allowance.
    return { allowance: -Number(kMatch[1]) * 10, flatRate: null };
  }

  // Unknown code — fall back to the standard personal allowance.
  return { allowance: config.personalAllowance, flatRate: null };
}

/** Annual income tax on an annualised gross, given a tax code. */
export function annualIncomeTax(
  annualGross: number,
  taxCode: string,
  config: TaxYearConfig,
): number {
  const { allowance, flatRate } = parseTaxCode(taxCode, config);
  const gross = Math.max(0, annualGross);

  if (flatRate !== null) return gross * flatRate;

  let effectiveAllowance = allowance;

  // Personal allowance taper: £1 lost for every £2 over £100,000.
  if (Number.isFinite(effectiveAllowance) && effectiveAllowance > 0) {
    const taper = Math.max(0, gross - config.allowanceTaperStart) / 2;
    effectiveAllowance = Math.max(0, effectiveAllowance - taper);
  }

  const taxable = Math.max(0, gross - effectiveAllowance);

  let tax = 0;
  let lower = 0;
  for (const band of config.bands) {
    const amountInBand = clampMin(taxable, lower, band.upTo) - lower;
    if (amountInBand > 0) tax += amountInBand * band.rate;
    lower = band.upTo;
    if (taxable <= lower) break;
  }
  return tax;
}

// ---------------------------------------------------------------------------
// National Insurance
// ---------------------------------------------------------------------------

export function employeeNi(
  periodGross: number,
  period: PayPeriod,
  config: TaxYearConfig,
): number {
  const factor = 1 / PERIODS_PER_YEAR[period];
  const pt = config.employeeNi.primaryThreshold * factor;
  const uel = config.employeeNi.upperEarningsLimit * factor;
  const earnings = Math.max(0, periodGross);

  const mainSlice = Math.max(0, Math.min(earnings, uel) - pt);
  const upperSlice = Math.max(0, earnings - uel);
  return round2(
    mainSlice * config.employeeNi.mainRate + upperSlice * config.employeeNi.upperRate,
  );
}

export function employerNi(
  periodGross: number,
  period: PayPeriod,
  config: TaxYearConfig,
): number {
  const st = config.employerNi.secondaryThreshold / PERIODS_PER_YEAR[period];
  const earnings = Math.max(0, periodGross);
  return round2(Math.max(0, earnings - st) * config.employerNi.rate);
}

// ---------------------------------------------------------------------------
// Pension (qualifying earnings, auto-enrolment)
// ---------------------------------------------------------------------------

export function pensionContributions(
  periodGross: number,
  period: PayPeriod,
  employeePct: number,
  employerPct: number,
  config: TaxYearConfig,
): { employee: number; employer: number } {
  const factor = 1 / PERIODS_PER_YEAR[period];
  const lower = config.pension.lower * factor;
  const upper = config.pension.upper * factor;
  const qualifying = Math.max(0, Math.min(periodGross, upper) - lower);

  return {
    employee: round2(qualifying * employeePct),
    employer: round2(qualifying * employerPct),
  };
}

// ---------------------------------------------------------------------------
// Student loans
// ---------------------------------------------------------------------------

export function studentLoanDeduction(
  periodGross: number,
  period: PayPeriod,
  plan: StudentLoanPlan,
  config: TaxYearConfig,
): number {
  const rule = config.studentLoan[plan];
  if (!rule || plan === "NONE") return 0;
  const threshold = rule.threshold / PERIODS_PER_YEAR[period];
  return round2(Math.max(0, periodGross - threshold) * rule.rate);
}

// ---------------------------------------------------------------------------
// Full payslip calculation
// ---------------------------------------------------------------------------

export interface PayslipStaffInput {
  taxCode: string;
  niNumber?: string | null;
  studentLoanPlan?: StudentLoanPlan | null;
  pensionEnrolled: boolean;
  pensionEmployeePct: number;
  pensionEmployerPct: number;
  holidayAccrualPct: number;
}

export interface PayslipInput {
  /** Taxable pay for the period (shift earnings), excluding holiday pay. */
  grossEarnings: number;
  /**
   * Holiday pay to add. If omitted it is accrued from grossEarnings at the
   * staff member's holidayAccrualPct (12.07% is the statutory minimum for
   * irregular-hours / agency workers).
   */
  holidayPay?: number;
  period: PayPeriod;
  taxYear: TaxYear | Date;
  staff: PayslipStaffInput;
  otherDeductions?: number;
  /** Non-taxable expense reimbursements (mileage/travel) added to net pay. */
  expenses?: number;
}

export interface PayslipLineResult {
  type: "EARNING" | "DEDUCTION" | "EMPLOYER_COST";
  label: string;
  quantity?: number;
  rate?: number;
  amount: number;
}

export interface PayslipResult {
  grossPay: number;
  holidayPay: number;
  expenses: number;
  taxablePay: number;
  paye: number;
  niEmployee: number;
  pensionEmployee: number;
  pensionEmployer: number;
  studentLoan: number;
  otherDeductions: number;
  employerNi: number;
  netPay: number;
  employerTotalCost: number;
  lines: PayslipLineResult[];
}

export function calculatePayslip(input: PayslipInput): PayslipResult {
  const taxYear: TaxYear =
    typeof input.taxYear === "string" ? input.taxYear : taxYearFor(input.taxYear);
  const config = getTaxYearConfig(taxYear);
  const { staff, period } = input;

  const gross = round2(Math.max(0, input.grossEarnings));
  const holidayPay =
    input.holidayPay !== undefined
      ? round2(Math.max(0, input.holidayPay))
      : round2(gross * (staff.holidayAccrualPct / 100));

  const taxablePay = round2(gross + holidayPay);

  // PAYE: annualise the period, compute annual tax, de-annualise.
  const annualGross = taxablePay * PERIODS_PER_YEAR[period];
  const paye = round2(annualIncomeTax(annualGross, staff.taxCode, config) / PERIODS_PER_YEAR[period]);

  const niEmployee = employeeNi(taxablePay, period, config);
  const employerNiValue = employerNi(taxablePay, period, config);

  const pension = staff.pensionEnrolled
    ? pensionContributions(
        taxablePay,
        period,
        staff.pensionEmployeePct / 100,
        staff.pensionEmployerPct / 100,
        config,
      )
    : { employee: 0, employer: 0 };

  const studentLoan = studentLoanDeduction(
    taxablePay,
    period,
    (staff.studentLoanPlan ?? "NONE") as StudentLoanPlan,
    config,
  );

  const otherDeductions = round2(Math.max(0, input.otherDeductions ?? 0));
  const expenses = round2(Math.max(0, input.expenses ?? 0));

  const netPay = round2(
    taxablePay - paye - niEmployee - pension.employee - studentLoan - otherDeductions + expenses,
  );

  const employerTotalCost = round2(taxablePay + pension.employer + employerNiValue);

  const lines: PayslipLineResult[] = [
    { type: "EARNING", label: "Shift earnings", amount: gross },
    ...(holidayPay > 0
      ? [{ type: "EARNING" as const, label: "Holiday pay", rate: staff.holidayAccrualPct, amount: holidayPay }]
      : []),
    ...(expenses > 0
      ? [{ type: "EARNING" as const, label: "Expenses — mileage/travel (non-taxable)", amount: expenses }]
      : []),
    { type: "DEDUCTION", label: `PAYE income tax (${staff.taxCode})`, amount: paye },
    { type: "DEDUCTION", label: "National Insurance (employee)", amount: niEmployee },
    ...(pension.employee > 0
      ? [{ type: "DEDUCTION" as const, label: "Workplace pension", amount: pension.employee }]
      : []),
    ...(studentLoan > 0
      ? [{ type: "DEDUCTION" as const, label: "Student loan", amount: studentLoan }]
      : []),
    ...(otherDeductions > 0
      ? [{ type: "DEDUCTION" as const, label: "Other deductions", amount: otherDeductions }]
      : []),
    { type: "EMPLOYER_COST", label: "Employer National Insurance", amount: employerNiValue },
    ...(pension.employer > 0
      ? [{ type: "EMPLOYER_COST" as const, label: "Employer pension", amount: pension.employer }]
      : []),
  ];

  return {
    grossPay: gross,
    holidayPay,
    expenses,
    taxablePay,
    paye,
    niEmployee,
    pensionEmployee: pension.employee,
    pensionEmployer: pension.employer,
    studentLoan,
    otherDeductions,
    employerNi: employerNiValue,
    netPay,
    employerTotalCost,
    lines,
  };
}

// ---------------------------------------------------------------------------
// Shift earnings (time-based premiums: night / weekend / bank holiday)
// ---------------------------------------------------------------------------

export interface ShiftRates {
  baseRate: number;
  nightRate?: number | null;
  weekendRate?: number | null;
  bankHolidayRate?: number | null;
}

export interface ShiftEarningsInput {
  startAt: Date;
  endAt: Date;
  breakMins: number;
  rates: ShiftRates;
  /** Night window, default 20:00 – 06:00. */
  nightWindow?: { startHour: number; endHour: number };
  /** Sleep-in shifts pay a flat allowance instead of hourly rates. */
  isSleepIn?: boolean;
  sleepInRate?: number;
  /**
   * Round paid minutes to the nearest N minutes (agencies typically use 15 —
   * "enter all hours to the nearest 1/4 hour"). 0 = exact minutes.
   */
  roundingMins?: number;
}

/** Rounds minutes to the nearest increment (e.g. 15 for quarter hours). */
export function roundMinutes(mins: number, increment: number): number {
  if (!increment || increment <= 0) return mins;
  return Math.round(mins / increment) * increment;
}

export interface ShiftEarningsResult {
  totalMins: number;
  paidMins: number;
  normalMins: number;
  nightMins: number;
  weekendMins: number;
  bankHolidayMins: number;
  totalEarnings: number;
  breakdown: { label: string; mins: number; rate?: number; amount: number }[];
}

type Category = "NORMAL" | "NIGHT" | "WEEKEND" | "BANK_HOLIDAY";

export function computeShiftEarnings(input: ShiftEarningsInput): ShiftEarningsResult {
  const { startAt, endAt, breakMins } = input;
  const night = input.nightWindow ?? { startHour: 20, endHour: 6 };

  // Sleep-in shifts pay a flat allowance, not hourly rates.
  if (input.isSleepIn && (input.sleepInRate ?? 0) > 0) {
    const totalMins = Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
    const paidMins = roundMinutes(
      Math.max(0, totalMins - Math.max(0, breakMins)),
      input.roundingMins ?? 0,
    );
    const amount = round2(input.sleepInRate ?? 0);
    return {
      totalMins,
      paidMins: Math.round(paidMins),
      normalMins: 0,
      nightMins: Math.round(paidMins),
      weekendMins: 0,
      bankHolidayMins: 0,
      totalEarnings: amount,
      breakdown: [{ label: "Sleep-in allowance (flat)", mins: Math.round(paidMins), amount }],
    };
  }

  const totalMins = Math.max(0, Math.round((endAt.getTime() - startAt.getTime()) / 60000));
  const paidMins = roundMinutes(
    Math.max(0, totalMins - Math.max(0, breakMins)),
    input.roundingMins ?? 0,
  );
  const scale = totalMins > 0 ? paidMins / totalMins : 0;

  const mins: Record<Category, number> = {
    NORMAL: 0,
    NIGHT: 0,
    WEEKEND: 0,
    BANK_HOLIDAY: 0,
  };

  const cursor = new Date(startAt);
  for (let m = 0; m < totalMins; m++) {
    const hour = cursor.getHours();
    const isNight =
      night.startHour <= night.endHour
        ? hour >= night.startHour && hour < night.endHour
        : hour >= night.startHour || hour < night.endHour;

    let category: Category;
    if (isBankHoliday(cursor)) category = "BANK_HOLIDAY";
    else if (isWeekend(cursor)) category = "WEEKEND";
    else if (isNight) category = "NIGHT";
    else category = "NORMAL";

    mins[category] += 1;
    cursor.setMinutes(cursor.getMinutes() + 1);
  }

  const rateFor = (c: Category): number => {
    switch (c) {
      case "BANK_HOLIDAY":
        return input.rates.bankHolidayRate ?? input.rates.weekendRate ?? input.rates.baseRate;
      case "WEEKEND":
        return input.rates.weekendRate ?? input.rates.baseRate;
      case "NIGHT":
        return input.rates.nightRate ?? input.rates.baseRate;
      default:
        return input.rates.baseRate;
    }
  };

  const paidCategoryMins: Record<Category, number> = {
    NORMAL: mins.NORMAL * scale,
    NIGHT: mins.NIGHT * scale,
    WEEKEND: mins.WEEKEND * scale,
    BANK_HOLIDAY: mins.BANK_HOLIDAY * scale,
  };

  const labels: Record<Category, string> = {
    NORMAL: "Standard hours",
    NIGHT: "Night premium",
    WEEKEND: "Weekend premium",
    BANK_HOLIDAY: "Bank holiday premium",
  };

  const breakdown = (Object.keys(paidCategoryMins) as Category[])
    .filter((c) => paidCategoryMins[c] > 0 && rateFor(c) > 0)
    .map((c) => ({
      label: labels[c],
      mins: round2(paidCategoryMins[c]),
      rate: rateFor(c),
      amount: round2((paidCategoryMins[c] / 60) * rateFor(c)),
    }));

  const totalEarnings = round2(breakdown.reduce((sum, b) => sum + b.amount, 0));

  return {
    totalMins,
    paidMins: Math.round(paidMins),
    normalMins: Math.round(paidCategoryMins.NORMAL),
    nightMins: Math.round(paidCategoryMins.NIGHT),
    weekendMins: Math.round(paidCategoryMins.WEEKEND),
    bankHolidayMins: Math.round(paidCategoryMins.BANK_HOLIDAY),
    totalEarnings,
    breakdown,
  };
}
