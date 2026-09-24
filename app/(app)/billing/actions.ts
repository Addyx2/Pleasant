"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import {
  computeInvoiceLine,
  defaultInvoiceReference,
  invoiceTotals,
} from "@/lib/billing";
import { prisma } from "@/lib/db";
import { round2 } from "@/lib/payroll/engine";
import { createInvoiceSchema } from "@/lib/validation";
import type { ActionState } from "@/app/(app)/shifts/actions";

export async function createInvoiceAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const parsed = createInvoiceSchema.safeParse({
    clientId: formData.get("clientId"),
    periodStart: formData.get("periodStart"),
    periodEnd: formData.get("periodEnd"),
    dueDate: formData.get("dueDate"),
    vatRatePct: formData.get("vatRatePct") || 0,
    reference: formData.get("reference"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check the invoice details" };
  }

  const { clientId, periodStart, periodEnd, dueDate, vatRatePct } = parsed.data;
  if (periodEnd < periodStart) return { error: "The period end must be after the start" };

  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId: user.agencyId },
  });
  if (!client) return { error: "That client could not be found" };

  const roundingMins = user.agency.roundingMins ?? 15;

  const timesheets = await prisma.timesheet.findMany({
    where: {
      agencyId: user.agencyId,
      status: "APPROVED",
      shift: { clientId, startAt: { gte: periodStart, lte: periodEnd } },
    },
    include: { shift: true, staff: true },
    orderBy: { clockIn: "asc" },
  });

  // Skip timesheets already on a previous invoice so coverage can't duplicate.
  const alreadyInvoiced = await prisma.invoiceLine.findMany({
    where: {
      timesheetId: { in: timesheets.map((t) => t.id) },
      invoice: { agencyId: user.agencyId },
    },
    select: { timesheetId: true },
  });
  const alreadyIds = new Set(alreadyInvoiced.map((l) => l.timesheetId));
  const billable = timesheets.filter((ts) => !alreadyIds.has(ts.id));

  const lines = billable.map((ts) =>
    computeInvoiceLine(
      {
        id: ts.id,
        breakMins: ts.breakMins,
        expenses: Number(ts.expenses),
        shift: {
          id: ts.shift.id,
          title: ts.shift.title,
          startAt: ts.shift.startAt,
          endAt: ts.shift.endAt,
          chargeRate: Number(ts.shift.chargeRate),
          isSleepIn: ts.shift.isSleepIn,
          sleepInRate: Number(ts.shift.sleepInRate),
        },
        staff: {
          id: ts.staff.id,
          baseRate: Number(ts.staff.baseRate),
          nightRate: ts.staff.nightRate ? Number(ts.staff.nightRate) : null,
          weekendRate: ts.staff.weekendRate ? Number(ts.staff.weekendRate) : null,
          bankHolidayRate: ts.staff.bankHolidayRate ? Number(ts.staff.bankHolidayRate) : null,
          holidayAccrualPct: Number(ts.staff.holidayAccrualPct),
        },
      },
      roundingMins,
    ),
  );

  if (lines.length === 0) {
    return { error: "No approved timesheets fall inside this period for that client" };
  }

  const totals = invoiceTotals(lines, vatRatePct);
  const vatPct = round2(vatRatePct);

  let reference = parsed.data.reference?.trim() || "";
  if (!reference) {
    const count = await prisma.invoice.count({ where: { agencyId: user.agencyId } });
    reference = defaultInvoiceReference(periodEnd, count + 1);
  }
  const existing = await prisma.invoice.findUnique({
    where: { agencyId_reference: { agencyId: user.agencyId, reference } },
  });
  if (existing) reference = `${reference}-${Date.now().toString().slice(-4)}`;

  const invoice = await prisma.$transaction(async (tx) => {
    const created = await tx.invoice.create({
      data: {
        agencyId: user.agencyId,
        clientId,
        reference,
        periodStart,
        periodEnd,
        dueDate,
        vatRatePct: vatPct,
        hoursTotal: totals.hoursTotal,
        chargeTotal: totals.chargeTotal,
        payTotal: totals.payTotal,
        marginTotal: totals.marginTotal,
        vatTotal: totals.vatTotal,
        grandTotal: totals.grandTotal,
        lines: {
          create: lines.map((line) => ({
            timesheetId: line.timesheetId,
            shiftId: line.shiftId,
            staffId: line.staffId,
            date: line.date,
            title: line.title,
            hours: line.hours,
            chargeRate: line.chargeRate,
            chargeAmount: line.chargeAmount,
            payAmount: line.payAmount,
            marginAmount: line.marginAmount,
          })),
        },
      },
    });
    return created;
  });

  revalidatePath("/billing");
  revalidatePath("/dashboard");
  redirect(`/billing/${invoice.id}`);
}

export async function setInvoiceStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!invoiceId || !["DRAFT", "ISSUED", "PAID", "VOID"].includes(status)) return;

  await prisma.invoice.updateMany({
    where: { id: invoiceId, agencyId: user.agencyId },
    data: {
      status: status as never,
      ...(status === "ISSUED" ? { issueDate: new Date() } : {}),
    },
  });

  revalidatePath("/billing");
  revalidatePath(`/billing/${invoiceId}`);
  revalidatePath("/dashboard");
}

export async function deleteInvoiceAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const invoiceId = String(formData.get("invoiceId") ?? "");
  if (!invoiceId) return;

  await prisma.invoice.deleteMany({
    where: { id: invoiceId, agencyId: user.agencyId, status: "DRAFT" },
  });

  revalidatePath("/billing");
  redirect("/billing");
}