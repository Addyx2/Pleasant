// UK payroll rates and thresholds.
//
// IMPORTANT: These figures are sourced from HMRC "Rates and thresholds for
// employers" and are provided as a starting point for the Pleasant payroll
// engine. Payroll is regulated — every rate below must be re-checked against
// the current HMRC guidance (and validated by a qualified payroll professional)
// before a run is finalised. Rates do not constitute tax advice.

export type TaxYear = "2025/26" | "2026/27";

export interface IncomeTaxBand {
  /** Upper bound of taxable income in this band, or Infinity for the top band. */
  upTo: number;
  rate: number;
}

export interface TaxYearConfig {
  label: TaxYear;
  personalAllowance: number;
  /** Taxable-income bands (after the personal allowance). */
  bands: IncomeTaxBand[];
  /** Where the personal allowance starts to taper (£1 lost per £2 over). */
  allowanceTaperStart: number;

  employeeNi: {
    /** Annual primary threshold — employee NI starts here. */
    primaryThreshold: number;
    /** Annual upper earnings limit — rate drops above this. */
    upperEarningsLimit: number;
    mainRate: number;
    upperRate: number;
  };
  employerNi: {
    /** Annual secondary threshold. */
    secondaryThreshold: number;
    rate: number;
  };
  employmentAllowance: number;

  pension: {
    /** Qualifying earnings lower limit. */
    lower: number;
    /** Qualifying earnings upper limit. */
    upper: number;
    employeeMin: number;
    employerMin: number;
  };

  studentLoan: Record<StudentLoanPlan, { threshold: number; rate: number }>;

  /** National Minimum / Living Wage hourly rates. */
  nmw: {
    rate21Plus: number;
    rate18to20: number;
    rate16to17: number;
    apprentice: number;
  };

  statutory: {
    sspWeekly: number;
    familyWeekly: number;
  };
}

export type StudentLoanPlan =
  | "NONE"
  | "PLAN_1"
  | "PLAN_2"
  | "PLAN_4"
  | "PLAN_5"
  | "POSTGRAD";

const TAX_2025_26: TaxYearConfig = {
  label: "2025/26",
  personalAllowance: 12570,
  bands: [
    { upTo: 37700, rate: 0.2 },
    { upTo: 112570, rate: 0.4 },
    { upTo: Infinity, rate: 0.45 },
  ],
  allowanceTaperStart: 100000,
  employeeNi: {
    primaryThreshold: 12570,
    upperEarningsLimit: 50270,
    mainRate: 0.08,
    upperRate: 0.02,
  },
  employerNi: { secondaryThreshold: 5000, rate: 0.15 },
  employmentAllowance: 10500,
  pension: { lower: 6240, upper: 50270, employeeMin: 0.05, employerMin: 0.03 },
  studentLoan: {
    NONE: { threshold: Infinity, rate: 0 },
    PLAN_1: { threshold: 26065, rate: 0.09 },
    PLAN_2: { threshold: 28470, rate: 0.09 },
    PLAN_4: { threshold: 32745, rate: 0.09 },
    PLAN_5: { threshold: 25000, rate: 0.09 },
    POSTGRAD: { threshold: 21000, rate: 0.06 },
  },
  nmw: {
    rate21Plus: 12.21,
    rate18to20: 10.0,
    rate16to17: 7.55,
    apprentice: 7.55,
  },
  statutory: { sspWeekly: 118.75, familyWeekly: 187.18 },
};

const TAX_2026_27: TaxYearConfig = {
  label: "2026/27",
  personalAllowance: 12570,
  bands: [
    { upTo: 37700, rate: 0.2 },
    { upTo: 112570, rate: 0.4 },
    { upTo: Infinity, rate: 0.45 },
  ],
  allowanceTaperStart: 100000,
  employeeNi: {
    primaryThreshold: 12570,
    upperEarningsLimit: 50270,
    mainRate: 0.08,
    upperRate: 0.02,
  },
  employerNi: { secondaryThreshold: 5000, rate: 0.15 },
  employmentAllowance: 10500,
  pension: { lower: 6240, upper: 50270, employeeMin: 0.05, employerMin: 0.03 },
  studentLoan: {
    NONE: { threshold: Infinity, rate: 0 },
    PLAN_1: { threshold: 26900, rate: 0.09 },
    PLAN_2: { threshold: 29385, rate: 0.09 },
    PLAN_4: { threshold: 33795, rate: 0.09 },
    PLAN_5: { threshold: 25000, rate: 0.09 },
    POSTGRAD: { threshold: 21000, rate: 0.06 },
  },
  nmw: {
    rate21Plus: 12.71,
    rate18to20: 10.85,
    rate16to17: 8.0,
    apprentice: 8.0,
  },
  statutory: { sspWeekly: 123.25, familyWeekly: 194.32 },
};

export const TAX_YEARS: Record<TaxYear, TaxYearConfig> = {
  "2025/26": TAX_2025_26,
  "2026/27": TAX_2026_27,
};

/** Returns the tax year label for a given date (UK tax year runs 6 Apr – 5 Apr). */
export function taxYearFor(date: Date): TaxYear {
  const y = date.getFullYear();
  const start = new Date(y, 3, 6);
  return date >= start ? (`${y}/${String((y + 1) % 100).padStart(2, "0")}` as TaxYear) : (`${y - 1}/${String(y % 100).padStart(2, "0")}` as TaxYear);
}

export function getTaxYearConfig(year: TaxYear): TaxYearConfig {
  const config = TAX_YEARS[year];
  if (!config) {
    throw new Error(`No UK payroll rates configured for tax year ${year}`);
  }
  return config;
}
