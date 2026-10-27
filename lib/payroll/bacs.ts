/**
 * Bank payment file builders.
 *
 * `buildPaymentsCsv` produces a bank bulk-payment CSV (columns most UK
 * banks' online channels accept for salary uploads: sort code, account
 * number, account name, amount, reference, date).
 *
 * `buildBacsStd18` produces fixed-width 96-column BACS STD18 payment records
 * (the layout used when handing a file to a bank or BACS bureau). Layout:
 *   cols  1-6    destination sort code
 *   cols  7-14   destination account number
 *   col   15     record type ("1")
 *   cols 16-17   transaction type ("99" = credit)
 *   cols 18-28   amount in pence, zero padded
 *   cols 29-46   destination account name
 *   cols 47-52   originator sort code
 *   cols 53-60   originator account number
 *   cols 61-78   payment reference
 *   cols 79-96   originator name
 *
 * Payees without a valid (6-digit sort / 8-digit account) are excluded and
 * counted as `skipped` — never silently rebanked.
 */

export interface BankPayee {
  reference: string;
  staffName: string;
  accountName: string;
  sortCode: string;
  bankAcct: string;
  amount: number;
}

export interface BacsFileInput {
  runReference: string;
  paymentDate: Date;
  originator: { sortCode: string; bankAcct: string; name: string };
  payees: BankPayee[];
}

export interface BankFileResult {
  count: number;
  skipped: number;
  total: number;
  missingBank: string[];
}

export function normalizeSortCode(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.slice(0, 6);
}

export function normalizeAccount(value: string): string {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits.slice(0, 8);
}

export function isValidBankDetails(sortCode: string, bankAcct: string): boolean {
  return normalizeSortCode(sortCode).length === 6 && normalizeAccount(bankAcct).length === 8;
}

function isoDate(date: Date): string {
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${m}-${d}`;
}

function csvCell(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function pad(target: string, width: number): string {
  return (target ?? "").slice(0, width).padEnd(width, " ");
}

function eligible(payees: BankPayee[]): { payees: BankPayee[]; missingBank: string[] } {
  const missingBank: string[] = [];
  const ok: BankPayee[] = [];
  for (const payee of payees) {
    if (isValidBankDetails(payee.sortCode, payee.bankAcct)) {
      ok.push(payee);
    } else {
      missingBank.push(payee.staffName);
    }
  }
  return { payees: ok, missingBank };
}

export function buildPaymentsCsv(input: BacsFileInput): BankFileResult & { csv: string } {
  const { payees, missingBank } = eligible(input.payees);
  const rows = [
    ["Sort code", "Account number", "Account name", "Amount", "Reference", "Payment date"].join(","),
    ...payees.map(
      (p) =>
        [
          normalizeSortCode(p.sortCode),
          normalizeAccount(p.bankAcct),
          csvCell(p.accountName || p.staffName),
          p.amount.toFixed(2),
          csvCell(p.reference),
          isoDate(input.paymentDate),
        ].join(","),
    ),
  ];
  return {
    csv: rows.join("\r\n"),
    count: payees.length,
    skipped: missingBank.length,
    total: payees.reduce((sum, p) => sum + p.amount, 0),
    missingBank,
  };
}

export function buildBacsStd18(input: BacsFileInput): BankFileResult & { records: string[] } {
  const { payees, missingBank } = eligible(input.payees);
  const out: string[] = [];
  for (const payee of payees) {
    const amountPence = String(Math.round(payee.amount * 100)).padStart(11, "0");
    out.push(
      [
        normalizeSortCode(payee.sortCode), // 1-6
        normalizeAccount(payee.bankAcct), // 7-14
        "1", // 15
        "99", // 16-17
        amountPence, // 18-28
        pad(payee.accountName || payee.staffName, 18), // 29-46
        normalizeSortCode(input.originator.sortCode), // 47-52
        normalizeAccount(input.originator.bankAcct), // 53-60
        pad(payee.reference, 18), // 61-78
        pad(input.originator.name, 18), // 79-96
      ].join(""),
    );
  }
  return {
    records: out,
    count: payees.length,
    skipped: missingBank.length,
    total: payees.reduce((sum, p) => sum + p.amount, 0),
    missingBank,
  };
}