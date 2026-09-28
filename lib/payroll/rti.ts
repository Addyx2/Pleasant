// RTI (Real Time Information) file export.
//
// Pleasant does not submit to HMRC's gateway itself. This module produces an
// accountant-friendly Full Payment Submission (FPS) data file for a FINALISED
// payroll run, listing every PAYE worker who is due a payment in that period.
// The agency (or their accountant) files the file through HMRC-recognised
// software. Ltd-company engagements are paid gross and are not part of PAYE,
// so they are excluded from the FPS and reported separately in the summary.

import type { PayPeriod } from "./engine";

export interface RtiPayslip {
  employee: { firstName: string; lastName: string };
  niNumber?: string | null;
  taxCode: string;
  hours: number;
  grossPay: number;
  holidayPay: number;
  expenses: number;
  taxablePay: number;
  paye: number;
  niEmployee: number;
  niEmployer: number;
  pensionEmployee: number;
  pensionEmployer: number;
  studentLoan: number;
  otherDeductions: number;
  netPay: number;
}

export interface RtiFileInput {
  runReference: string;
  taxYear: string;
  payFrequency: PayPeriod;
  paymentDate: Date;
  employerPayeRef?: string | null;
  payslips: RtiPayslip[];
}

export interface RtiSummary {
  totalPayslips: number;
  // Ltd-company workers are paid gross; they are not PAYE employees.
  excludedLtd: number;
  included: number;
  totalGross: number;
  totalTaxable: number;
  totalPaye: number;
  totalNiEmployee: number;
  totalNiEmployer: number;
  totalPensionEmployee: number;
  totalPensionEmployer: number;
  totalStudentLoan: number;
  totalNet: number;
  totalHours: number;
}

const HEADERS = [
  "run_reference",
  "tax_year",
  "pay_frequency",
  "payment_date",
  "employer_paye_ref",
  "employee_first_name",
  "employee_last_name",
  "ni_number",
  "tax_code",
  "gross_pay",
  "holiday_pay",
  "expenses",
  "taxable_pay",
  "paye",
  "ni_employee",
  "ni_employer",
  "pension_employee",
  "pension_employer",
  "student_loan",
  "other_deductions",
  "net_pay",
  "hours_worked",
];

function csvCell(value: string | number | Date | null | undefined): string {
  const text = value === null || value === undefined ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function csvRow(values: (string | number | Date | null | undefined)[]): string {
  return values.map(csvCell).join(",");
}

/** ISO date (yyyy-mm-dd) in the provider's local time. */
function toISODate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function buildFpsCsv(input: RtiFileInput): { csv: string; summary: RtiSummary } {
  const ltd = input.payslips.filter((p) => p.taxCode === "LTD");
  const included = input.payslips.filter((p) => p.taxCode !== "LTD");

  const sum = (key: (p: RtiPayslip) => number) =>
    Math.round(included.reduce((acc, p) => acc + key(p), 0) * 100) / 100;

  const summary: RtiSummary = {
    totalPayslips: input.payslips.length,
    excludedLtd: ltd.length,
    included: included.length,
    totalGross: sum((p) => p.grossPay),
    totalTaxable: sum((p) => p.taxablePay),
    totalPaye: sum((p) => p.paye),
    totalNiEmployee: sum((p) => p.niEmployee),
    totalNiEmployer: sum((p) => p.niEmployer),
    totalPensionEmployee: sum((p) => p.pensionEmployee),
    totalPensionEmployer: sum((p) => p.pensionEmployer),
    totalStudentLoan: sum((p) => p.studentLoan),
    totalNet: sum((p) => p.netPay),
    totalHours: Math.round(sum((p) => p.hours) * 100) / 100,
  };

  const rows = [csvRow(HEADERS)];
  for (const p of included) {
    rows.push(
      csvRow([
        input.runReference,
        input.taxYear,
        input.payFrequency,
        toISODate(input.paymentDate),
        input.employerPayeRef,
        p.employee.firstName,
        p.employee.lastName,
        p.niNumber,
        p.taxCode,
        p.grossPay,
        p.holidayPay,
        p.expenses,
        p.taxablePay,
        p.paye,
        p.niEmployee,
        p.niEmployer,
        p.pensionEmployee,
        p.pensionEmployer,
        p.studentLoan,
        p.otherDeductions,
        p.netPay,
        p.hours,
      ]),
    );
  }

  return { csv: rows.join("\n"), summary };
}

/** A compact human summary by totals, for the run's closing checklist. */
export function summarizeFps(input: RtiFileInput): RtiSummary {
  return buildFpsCsv(input).summary;
}