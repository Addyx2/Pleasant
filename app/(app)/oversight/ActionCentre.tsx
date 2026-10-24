import Link from "next/link";
import { addHours, differenceInCalendarDays, formatDistanceToNowStrict, startOfDay } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  BadgePoundSterling,
  Banknote,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ShieldAlert,
  UserRoundX,
} from "lucide-react";

import { decideTimesheetAction } from "@/app/(app)/timesheets/actions";
import { CLIENT_NAME_SELECT, clientName } from "@/lib/clients";
import { expiryState } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { cn, formatCurrency, formatDate, formatHours, formatTime } from "@/lib/utils";
import { Card } from "@/components/ui";

type Severity = "critical" | "warning";

interface ActionItem {
  key: string;
  severity: Severity;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  detail: string;
  /** Primary fix: a link, or a form for one-click fixes. */
  fix: React.ReactNode;
  secondary?: React.ReactNode;
}

const MAX_ITEMS = 8;

const fixClass = (severity: Severity) =>
  cn(
    "inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-semibold text-white shadow-btn transition",
    severity === "critical" ? "bg-red-600 hover:bg-red-700" : "bg-slate-900 hover:bg-slate-800",
  );
const secondaryClass = "text-xs font-semibold text-slate-500 transition hover:text-slate-800";

function FixLink({ href, severity, children }: { href: string; severity: Severity; children: React.ReactNode }) {
  return (
    <Link href={href} className={fixClass(severity)}>
      {children} <ArrowRight className="h-3.5 w-3.5" />
    </Link>
  );
}

const when = (date: Date) => `${formatDate(date)}, ${formatTime(date)}`;

/**
 * Everything that is blocking work right now, most urgent first, each with
 * the action that clears it. Red items stop shifts happening or being paid;
 * amber items need someone to review them.
 */
export async function ActionCentre({ agencyId, isAdmin }: { agencyId: string; isAdmin: boolean }) {
  const now = new Date();
  const soon = addHours(now, 48);

  const [unattended, openSoon, timesheets, clients, staff, overdue] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId, status: "UNATTENDED" },
      select: { id: true, title: true, startAt: true, client: { select: CLIENT_NAME_SELECT } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.shift.findMany({
      where: { agencyId, status: "OPEN", startAt: { gte: now, lte: soon } },
      select: { id: true, title: true, startAt: true, client: { select: CLIENT_NAME_SELECT } },
      orderBy: { startAt: "asc" },
      take: 5,
    }),
    prisma.timesheet.findMany({
      where: { agencyId, status: "PENDING" },
      select: {
        id: true,
        shiftId: true,
        workedMins: true,
        clockIn: true,
        clientAuthAt: true,
        staff: { select: { firstName: true, lastName: true } },
        shift: { select: { title: true } },
      },
      orderBy: { clockIn: "asc" },
      take: 6,
    }),
    prisma.client.findMany({
      where: { agencyId, status: "ACTIVE", OR: [{ rates: { none: {} } }, { contacts: { none: { isSignatory: true } } }] },
      select: {
        id: true,
        ...CLIENT_NAME_SELECT,
        _count: {
          select: {
            rates: true,
            contacts: { where: { isSignatory: true } },
            shifts: { where: { startAt: { gte: now }, status: { not: "CANCELLED" } } },
          },
        },
      },
      orderBy: { name: "asc" },
    }),
    prisma.staffProfile.findMany({
      where: { agencyId, status: "ACTIVE" },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        dbsExpiry: true,
        rightToWork: { select: { expiryDate: true } },
      },
    }),
    isAdmin
      ? prisma.invoice.findMany({
          where: { agencyId, status: "ISSUED", dueDate: { lt: startOfDay(now) } },
          select: { grandTotal: true, dueDate: true },
        })
      : Promise.resolve([]),
  ]);

  const items: ActionItem[] = [];

  for (const shift of unattended) {
    items.push({
      key: `unattended-${shift.id}`,
      severity: "critical",
      icon: UserRoundX,
      title: `Unattended: ${shift.title}`,
      detail: `${clientName(shift.client, "No client")} · ${when(shift.startAt)} · the carer didn't turn up`,
      fix: <FixLink href="/shifts/unattended" severity="critical">Find a carer</FixLink>,
    });
  }

  for (const shift of openSoon) {
    const severity: Severity = shift.startAt.getTime() - now.getTime() < 24 * 3600_000 ? "critical" : "warning";
    items.push({
      key: `open-${shift.id}`,
      severity,
      icon: CalendarClock,
      title: `No carer for ${shift.title}`,
      detail: `${clientName(shift.client, "No client")} · starts ${formatDistanceToNowStrict(shift.startAt, { addSuffix: true })} (${when(shift.startAt)})`,
      fix: <FixLink href={`/shifts/${shift.id}`} severity={severity}>Assign a carer</FixLink>,
      secondary: (
        <Link href="/dispatch" className={secondaryClass}>
          Offer out
        </Link>
      ),
    });
  }

  // Carers who can't lawfully work: expired DBS, or right to work missing or expired.
  const blocked = staff.filter((s) => {
    const dbs = expiryState(s.dbsExpiry, now);
    const rtw = s.rightToWork ? expiryState(s.rightToWork.expiryDate, now) : "MISSING";
    return dbs === "EXPIRED" || dbs === "MISSING" || rtw === "EXPIRED" || rtw === "MISSING";
  });
  for (const s of blocked.slice(0, 3)) {
    const dbs = expiryState(s.dbsExpiry, now);
    const reasons = [
      dbs === "EXPIRED" ? "DBS expired" : dbs === "MISSING" ? "no DBS on file" : null,
      !s.rightToWork ? "no right to work on file" : expiryState(s.rightToWork.expiryDate, now) === "EXPIRED" ? "right to work expired" : null,
    ].filter(Boolean);
    items.push({
      key: `compliance-${s.id}`,
      severity: "critical",
      icon: ShieldAlert,
      title: `${s.firstName} ${s.lastName} isn't cleared to work`,
      detail: `${reasons.join(" and ")}. Don't book them until it's fixed.`,
      fix: <FixLink href={`/staff/${s.id}`} severity="critical">Update record</FixLink>,
    });
  }
  if (blocked.length > 3) {
    items.push({
      key: "compliance-more",
      severity: "critical",
      icon: ShieldAlert,
      title: `${blocked.length - 3} more carers aren't cleared to work`,
      detail: "Missing or expired DBS or right to work.",
      fix: <FixLink href="/compliance" severity="critical">Open compliance</FixLink>,
    });
  }

  for (const client of clients) {
    const noRates = client._count.rates === 0;
    const noSignatory = client._count.contacts === 0;
    // A client with booked shifts and no rate card is billing £0 right now.
    const severity: Severity = noRates && client._count.shifts > 0 ? "critical" : "warning";
    const missing = [noRates ? "no rate card" : null, noSignatory ? "no timesheet signatory" : null].filter(Boolean);
    items.push({
      key: `client-${client.id}`,
      severity,
      icon: BadgePoundSterling,
      title: `${clientName(client)} isn't fully set up`,
      detail: `${missing.join(" and ")}${client._count.shifts > 0 ? ` · ${client._count.shifts} upcoming shift${client._count.shifts === 1 ? "" : "s"}` : ""}. ${noRates ? "New shifts can't be priced." : "You can't send a Pleasant Link for sign-off."}`,
      fix: noRates ? (
        <FixLink href={`/clients/${client.id}#rates`} severity={severity}>Add rate card</FixLink>
      ) : (
        <FixLink href={`/clients/${client.id}#contacts`} severity={severity}>Add signatory</FixLink>
      ),
      secondary:
        noRates && noSignatory ? (
          <Link href={`/clients/${client.id}#contacts`} className={secondaryClass}>
            Add signatory
          </Link>
        ) : undefined,
    });
  }

  if (overdue.length > 0) {
    const total = overdue.reduce((sum, i) => sum + Number(i.grandTotal), 0);
    const oldest = Math.max(...overdue.map((i) => differenceInCalendarDays(now, i.dueDate ?? now)));
    const severity: Severity = oldest > 30 ? "critical" : "warning";
    items.push({
      key: "overdue",
      severity,
      icon: Banknote,
      title: `${formatCurrency(total)} overdue across ${overdue.length} invoice${overdue.length === 1 ? "" : "s"}`,
      detail: `The oldest is ${oldest} day${oldest === 1 ? "" : "s"} past due.`,
      fix: <FixLink href="#receivables" severity={severity}>Chase or mark paid</FixLink>,
    });
  }

  for (const ts of timesheets) {
    const signed = ts.clientAuthAt !== null;
    items.push({
      key: `timesheet-${ts.id}`,
      severity: "warning",
      icon: ClipboardCheck,
      title: `Timesheet: ${ts.staff.firstName} ${ts.staff.lastName}, ${formatHours(ts.workedMins)}`,
      detail: `${ts.shift.title} · ${formatDate(ts.clockIn)} · ${signed ? "signed off by the client" : "waiting for the client's sign-off"}`,
      fix: signed ? (
        <form action={decideTimesheetAction}>
          <input type="hidden" name="timesheetId" value={ts.id} />
          <input type="hidden" name="decision" value="APPROVED" />
          <button type="submit" className={fixClass("warning")}>
            <CheckCircle2 className="h-3.5 w-3.5" /> Approve
          </button>
        </form>
      ) : (
        <FixLink href={`/shifts/${ts.shiftId}`} severity="warning">Get sign-off</FixLink>
      ),
      secondary: signed ? (
        <Link href={`/shifts/${ts.shiftId}`} className={secondaryClass}>
          Review
        </Link>
      ) : undefined,
    });
  }

  items.sort((a, b) => (a.severity === b.severity ? 0 : a.severity === "critical" ? -1 : 1));
  const critical = items.filter((i) => i.severity === "critical").length;
  const review = items.length - critical;
  const shown = items.slice(0, MAX_ITEMS);

  if (items.length === 0) {
    return (
      <Card className="flex items-center gap-4 border-emerald-200 bg-emerald-50/60 p-5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-sm font-semibold text-emerald-900">All clear</p>
          <p className="mt-0.5 text-xs text-emerald-800">
            No uncovered shifts, approvals, compliance gaps or setup blockers right now.
          </p>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("overflow-hidden", critical > 0 ? "border-red-200 ring-1 ring-red-100" : "border-amber-200")}>
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4",
          critical > 0 ? "border-red-100 bg-red-50/60" : "border-amber-100 bg-amber-50/60",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-lg",
              critical > 0 ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700",
            )}
          >
            <AlertTriangle className="h-4 w-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
            <p className="text-xs text-slate-600">Most urgent first. Each item has the action that clears it.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs font-semibold">
          {critical > 0 ? (
            <span className="rounded-full bg-red-600 px-2.5 py-1 text-white">{critical} critical</span>
          ) : null}
          {review > 0 ? (
            <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900 ring-1 ring-inset ring-amber-600/20">
              {review} to review
            </span>
          ) : null}
        </div>
      </div>
      <ul className="divide-y divide-slate-100">
        {shown.map((item) => (
          <li key={item.key} className="relative flex flex-wrap items-center gap-3 px-5 py-3 sm:flex-nowrap">
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1",
                item.severity === "critical" ? "bg-red-500" : "bg-amber-400",
              )}
              aria-hidden="true"
            />
            <item.icon
              className={cn("h-4 w-4 shrink-0", item.severity === "critical" ? "text-red-600" : "text-amber-600")}
            />
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 text-sm font-medium text-slate-900">
                {item.title}
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                    item.severity === "critical" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800",
                  )}
                >
                  {item.severity === "critical" ? "Critical" : "Review"}
                </span>
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
            </div>
            <div className="flex w-full items-center justify-end gap-3 sm:w-auto">
              {item.secondary}
              {item.fix}
            </div>
          </li>
        ))}
      </ul>
      {items.length > MAX_ITEMS || timesheets.length === 6 ? (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>{items.length > MAX_ITEMS ? `${items.length - MAX_ITEMS} more not shown.` : "Showing the oldest timesheets first."}</span>
          <span className="flex gap-4">
            <Link href="/timesheets" className="font-semibold text-brand-700 hover:text-brand-800">
              All timesheets →
            </Link>
            <Link href="/compliance" className="font-semibold text-brand-700 hover:text-brand-800">
              Compliance →
            </Link>
          </span>
        </div>
      ) : null}
    </Card>
  );
}

