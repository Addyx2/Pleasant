"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  calculatePayslip,
  computeShiftEarnings,
  round2,
  type PayPeriod,
} from "@/lib/payroll/engine";
import { taxYearFor, type StudentLoanPlan } from "@/lib/payroll/rates";
import { payrollRunSchema } from "@/lib/validation";
import type { ActionState } from "@/app/(app)/shifts/actions";

function defaultReference(periodEnd: Date, period: PayPeriod): string {
  const y = periodEnd.getFullYear();
  const m = String(periodEnd.getMonth() + 1).padStart(2, "0");
  const suffix: Record<PayPeriod, string> = {
    WEEKLY: "W",
    FORTNIGHTLY: "F",
    FOUR_WEEKLY: "4W",
    MONTHLY: "M",
  };
  return `${y}-${m}-${suffix[period]}`;
}

type ShiftBreakdown = { label: string; mins: number; rate?: number; amount: number };

/** Ltd-company workers are paid gross — no PAYE deductions. */
function ltdPayslip(
  grossFromShifts: number,
  expenses: number,
  breakdown: ShiftBreakdown[],
): ReturnType<typeof calculatePayslip> {
  const gross = round2(grossFromShifts);
  const expenseTotal = round2(expenses);
  return {
    grossPay: gross,
    holidayPay: 0,
    expenses: expenseTotal,
    taxablePay: gross,
    paye: 0,
    niEmployee: 0,
    pensionEmployee: 0,
    pensionEmployer: 0,
    studentLoan: 0,
    otherDeductions: 0,
    employerNi: 0,
    netPay: round2(gross + expenseTotal),
    employerTotalCost: gross,
    lines: [
      ...breakdown.map((b) => ({
        type: "EARNING" as const,
        label: b.label,
        quantity: b.mins,
        rate: b.rate,
        amount: b.amount,
      })),
      ...(expenseTotal > 0
        ? [
            {
              type: "EARNING" as const,
              label: "Expenses — mileage/travel (non-taxable)",
              amount: expenseTotal,
            },
          ]
        : []),
    ],
  };
}

export async function generatePayrollRunAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const parsed = payrollRunSchema.safeParse({
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    payDate: formData.get("payDate"),
    period: formData.get("period") || user.agency.payFrequency || "MONTHLY",
    reference: formData.get("reference"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the pay period dates" };
  }

  const { periodStart, periodEnd, payDate, period } = parsed.data;
  if (periodEnd < periodStart) return { error: "The period end must be after the start" };

  const taxYear = taxYearFor(periodEnd);
  const roundingMins = user.agency.roundingMins ?? 15;

  const timesheets = await prisma.timesheet.findMany({
    where: {
      agencyId: user.agencyId,
      status: "APPROVED",
      shift: { startAt: { gte: periodStart, lte: periodEnd } },
    },
    include: { shift: true, staff: true },
  });

  if (timesheets.length === 0) {
    return { error: "No approved timesheets fall inside this period" };
  }

  // Group approved timesheets by carer.
  const byStaff = new Map<string, typeof timesheets>();
  for (const ts of timesheets) {
    const list = byStaff.get(ts.staffId) ?? [];
    list.push(ts);
    byStaff.set(ts.staffId, list);
  }

  let reference = parsed.data.reference?.trim() || defaultReference(periodEnd, period);
  const existing = await prisma.payrollRun.findUnique({
    where: { agencyId_reference: { agencyId: user.agencyId, reference } },
  });
  if (existing) reference = `${reference}-${Date.now().toString().slice(-4)}`;

  const payslipData = [] as {
    staffId: string;
    timesheetHours: number;
    result: ReturnType<typeof calculatePayslip>;
    staff: (typeof timesheets)[number]["staff"];
    breakdown: ShiftBreakdown[];
  }[];

  let grossTotal = 0;
  let payeTotal = 0;
  let niTotal = 0;
  let pensionTotal = 0;
  let netTotal = 0;
  let employerNiTotal = 0;

  for (const [staffId, list] of byStaff) {
    const staff = list[0].staff;
    const isLtd = (staff.engagementType ?? "PAYE") === "LTD";

    let grossFromShifts = 0;
    let paidMins = 0;
    let expenseTotal = 0;
    const breakdownMap = new Map<string, { mins: number; rate?: number; amount: number }>();

    for (const ts of list) {
      const earnings = computeShiftEarnings({
        startAt: ts.shift.startAt,
        endAt: ts.shift.endAt,
        breakMins: ts.breakMins,
        rates: {
          baseRate: Number(staff.baseRate),
          nightRate: staff.nightRate ? Number(staff.nightRate) : null,
          weekendRate: staff.weekendRate ? Number(staff.weekendRate) : null,
          bankHolidayRate: staff.bankHolidayRate ? Number(staff.bankHolidayRate) : null,
        },
        isSleepIn: ts.shift.isSleepIn,
        sleepInRate: Number(ts.shift.sleepInRate),
        roundingMins,
      });
      grossFromShifts += earnings.totalEarnings;
      paidMins += earnings.paidMins;
      expenseTotal += Number(ts.expenses);

      for (const line of earnings.breakdown) {
        const entry = breakdownMap.get(line.label) ?? {
          mins: 0,
          rate: line.rate,
          amount: 0,
        };
        entry.mins += line.mins;
        entry.amount = round2(entry.amount + line.amount);
        breakdownMap.set(line.label, entry);
      }
    }

    const breakdown: ShiftBreakdown[] = [...breakdownMap.entries()].map(([label, v]) => ({
      label,
      ...v,
    }));

    const result = isLtd
      ? ltdPayslip(grossFromShifts, expenseTotal, breakdown)
      : calculatePayslip({
          grossEarnings: round2(grossFromShifts),
          period,
          taxYear,
          staff: {
            taxCode: staff.taxCode,
            studentLoanPlan: (staff.studentLoanPlan ?? "NONE") as StudentLoanPlan,
            pensionEnrolled: staff.pensionEnrolled,
            pensionEmployeePct: Number(staff.pensionEmployeePct),
            pensionEmployerPct: Number(staff.pensionEmployerPct),
            holidayAccrualPct: Number(staff.holidayAccrualPct),
          },
          expenses: round2(expenseTotal),
        });

    grossTotal += result.grossPay;
    payeTotal += result.paye;
    niTotal += result.niEmployee;
    pensionTotal += result.pensionEmployee;
    netTotal += result.netPay;
    employerNiTotal += result.employerNi;

    payslipData.push({
      staffId,
      timesheetHours: round2(paidMins / 60),
      result,
      staff,
      breakdown,
    });
  }

  const run = await prisma.$transaction(async (tx) => {
    const created = await tx.payrollRun.create({
      data: {
        agencyId: user.agencyId,
        reference,
        periodStart,
        periodEnd,
        payDate,
        taxYear,
        status: "DRAFT",
        grossTotal: round2(grossTotal),
        payeTotal: round2(payeTotal),
        niTotal: round2(niTotal),
        pensionTotal: round2(pensionTotal),
        netTotal: round2(netTotal),
        employerNiTotal: round2(employerNiTotal),
      },
    });

    for (const item of payslipData) {
      const { result, staff } = item;
      const isLtd = (staff.engagementType ?? "PAYE") === "LTD";
      await tx.payslip.create({
        data: {
          payrollRunId: created.id,
          staffId: item.staffId,
          timesheetHours: item.timesheetHours,
          grossPay: result.grossPay,
          holidayPay: result.holidayPay,
          expenses: result.expenses,
          taxablePay: result.taxablePay,
          paye: result.paye,
          niEmployee: result.niEmployee,
          pensionEmployee: result.pensionEmployee,
          pensionEmployer: result.pensionEmployer,
          studentLoan: result.studentLoan,
          otherDeductions: result.otherDeductions,
          employerNi: result.employerNi,
          netPay: result.netPay,
          taxCode: isLtd ? "LTD" : staff.taxCode,
          niNumber: staff.niNumber,
          lines: {
            create: [
              ...item.breakdown.map((b, index) => ({
                type: "EARNING" as const,
                label: b.label,
                quantity: b.mins,
                rate: b.rate ?? null,
                amount: b.amount,
                sortOrder: index,
              })),
              ...result.lines.map((line, index) => ({
                type: line.type,
                label: line.label,
                quantity: line.quantity ?? null,
                rate: line.rate ?? null,
                amount: line.amount,
                sortOrder: 100 + index,
              })),
            ],
          },
        },
      });
    }

    return created;
  });

  revalidatePath("/payroll");
  revalidatePath("/dashboard");
  redirect(`/payroll/${run.id}`);
}

export async function setPayrollStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const runId = String(formData.get("runId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!runId || !["DRAFT", "APPROVED", "FINALISED", "PAID"].includes(status)) return;

  await prisma.payrollRun.updateMany({
    where: { id: runId, agencyId: user.agencyId },
    data: { status: status as never },
  });

  revalidatePath("/payroll");
  revalidatePath(`/payroll/${runId}`);
}

export async function deletePayrollRunAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const runId = String(formData.get("runId") ?? "");
  if (!runId) return;

  await prisma.payrollRun.deleteMany({
    where: { id: runId, agencyId: user.agencyId, status: "DRAFT" },
  });

  revalidatePath("/payroll");
  redirect("/payroll");
}
