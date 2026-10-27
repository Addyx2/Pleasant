import { addDays } from "date-fns";

import { aultrumIdConfigured, reportActivity, type ActivitySummary } from "@/lib/aultrum-id";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";

const BACK_OFFICE = ["Admin", "Manager"];

/**
 * The live summaries Pleasant shows in Aultrum Workspace for an agency: counts
 * and totals only, never names or care details. Each has a stable id, so
 * pushing again updates it rather than adding another.
 */
export async function workspaceSummaries(agencyId: string, now = new Date()): Promise<ActivitySummary[]> {
  const app = process.env.APP_URL?.replace(/\/+$/, "");
  const link = (path: string) => (app ? `${app}${path}` : undefined);
  const [unfilled, timesheets, overdue, blocked] = await Promise.all([
    prisma.shift.count({ where: { agencyId, status: "OPEN", staffId: null, startAt: { gte: now, lt: addDays(now, 7) } } }),
    prisma.timesheet.count({ where: { agencyId, status: "PENDING" } }),
    prisma.invoice.aggregate({
      where: { agencyId, status: "ISSUED", dueDate: { lt: now } },
      _count: true,
      _sum: { grandTotal: true },
    }),
    prisma.staffProfile.count({
      where: { agencyId, status: "ACTIVE", OR: [{ dbsExpiry: null }, { dbsExpiry: { lt: now } }] },
    }),
  ]);
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  return [
    {
      id: "shifts-unfilled-7d",
      kind: "shifts",
      title: unfilled ? `${plural(unfilled, "shift needs", "shifts need")} a carer this week` : "Every shift this week has a carer",
      detail: "Open shifts starting in the next 7 days.",
      url: link("/dispatch"),
      roles: BACK_OFFICE,
      occurredAt: now,
    },
    {
      id: "timesheets-awaiting",
      kind: "timesheets",
      title: timesheets ? `${plural(timesheets, "timesheet", "timesheets")} to approve` : "No timesheets waiting",
      url: link("/timesheets"),
      roles: BACK_OFFICE,
      occurredAt: now,
    },
    {
      id: "invoices-overdue",
      kind: "invoices",
      title: overdue._count
        ? `${formatCurrency(Number(overdue._sum.grandTotal ?? 0))} overdue across ${plural(overdue._count, "invoice", "invoices")}`
        : "No overdue invoices",
      url: link("/billing"),
      roles: ["Admin"],
      occurredAt: now,
    },
    {
      id: "compliance-blocked",
      kind: "compliance",
      title: blocked ? `${plural(blocked, "carer has", "carers have")} no current DBS on file` : "Every active carer has a current DBS on file",
      url: link("/compliance"),
      roles: BACK_OFFICE,
      occurredAt: now,
    },
  ];
}

/** Sends the agency's summaries to Workspace if anyone there uses Aultrum ID. Never throws. */
export async function pushWorkspaceActivity(agencyId: string): Promise<void> {
  if (!aultrumIdConfigured()) return;
  try {
    const linked = await prisma.user.count({ where: { agencyId, aultrumSub: { not: null }, deactivatedAt: null } });
    if (linked === 0) return;
    await reportActivity(agencyId, await workspaceSummaries(agencyId));
  } catch (error) {
    console.error("workspace activity failed", error);
  }
}
