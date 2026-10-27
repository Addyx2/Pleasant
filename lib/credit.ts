import { addDays, startOfDay } from "date-fns";

export interface HomeLedgerRow {
  id: string;
  status: "DRAFT" | "ISSUED" | "PAID" | "VOID";
  issueDate: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  grandTotal: number;
}

export type CreditBand = "A" | "B" | "C" | "D" | "E";

export interface HomeCreditHealth {
  score: number;
  band: CreditBand;
  label: string;
  detail: string;
  paidCount: number;
  paidOnTimeCount: number | null;
  overdueAmount: number;
  openAmount: number;
}

export function creditBand(score: number): CreditBand {
  if (score >= 85) return "A";
  if (score >= 70) return "B";
  if (score >= 50) return "C";
  if (score >= 30) return "D";
  return "E";
}

export function creditBandTone(band: CreditBand): "emerald" | "blue" | "amber" | "red" {
  if (band === "A" || band === "B") return "emerald";
  if (band === "C") return "amber";
  return "red";
}

/**
 * Payment-health score derived only from the real invoice ledger:
 * repayment history, on-time punctuality and the current overdue position.
 * No fabricated risk — a home with zero paid invoices is simply "unproven".
 */
export function creditHealth(rows: HomeLedgerRow[], now: Date = new Date()): HomeCreditHealth {
  const paid = rows.filter((r) => r.status === "PAID");
  const open = rows.filter((r) => r.status === "ISSUED");

  const today = startOfDay(now);
  const paidOnTime = paid.filter(
    (r) => r.paidAt && r.dueDate && r.paidAt <= startOfDay(addDays(r.dueDate, 1)),
  );
  const openAmount = open.reduce((sum, r) => sum + r.grandTotal, 0);
  const overdueAmount = open
    .filter((r) => r.dueDate && startOfDay(r.dueDate) < today)
    .reduce((sum, r) => sum + r.grandTotal, 0);

  let score = 50;
  if (paid.length >= 3) score += 20;
  else if (paid.length >= 1) score += 10;
  else score -= 15;

  if (paid.length > 0) {
    const onTimeRate = paidOnTime.length / paid.length;
    if (onTimeRate >= 0.9) score += 15;
    else if (onTimeRate >= 0.5) score += 7;
    else score -= 8;
  }

  if (open.length > 0) {
    if (overdueAmount > 0) {
      const lateShare = overdueAmount / Math.max(1, openAmount);
      score -= Math.round(20 * Math.min(1, lateShare + 0.25));
    } else {
      score += 5;
    }
  }

  const clamped = Math.max(0, Math.min(100, score));
  const band = creditBand(clamped);

  const detail =
    paid.length === 0
      ? "No invoices paid yet — repayment behaviour is unproven"
      : `${paidOnTime.length}/${paid.length} paid on time · £${overdueAmount.toFixed(2)} overdue`;

  return {
    score: clamped,
    band,
    label: `Home ${band}`,
    detail,
    paidCount: paid.length,
    paidOnTimeCount: paid.length > 0 ? paidOnTime.length : null,
    overdueAmount,
    openAmount,
  };
}

export function asLedgerRow(row: {
  id: string;
  status: string;
  issueDate: Date | null;
  dueDate: Date | null;
  paidAt: Date | null;
  grandTotal: unknown;
}): HomeLedgerRow {
  return {
    id: row.id,
    status: row.status as HomeLedgerRow["status"],
    issueDate: row.issueDate,
    dueDate: row.dueDate,
    paidAt: row.paidAt,
    grandTotal: Number(row.grandTotal),
  };
}