import { addDays, endOfDay, format, startOfDay } from "date-fns";
import type { z } from "zod";

import { searchAction } from "@/app/(app)/search/actions";
import { createShiftAction, assignShiftFormAction, updateShiftStatusAction } from "@/app/(app)/shifts/actions";
import { approveShiftRequestAction, rejectShiftRequestAction } from "@/app/(app)/shifts/requests/actions";
import { offerShiftAction } from "@/app/(app)/dispatch/actions";
import { decideTimesheetAction } from "@/app/(app)/timesheets/actions";
import { createStaffAction, setStaffStatusAction } from "@/app/(app)/staff/actions";
import { createInviteAction } from "@/app/(app)/staff/invite/actions";
import { addTrainingAction, saveDbsAction } from "@/app/(app)/compliance/actions";
import {
  createClientAction,
  createContactAction,
  createPleasantLinkAction,
  createSiteAction,
  saveRateAction,
} from "@/app/(app)/clients/actions";
import { generateRotaWeekAction } from "@/app/(app)/rota/actions";
import { createInvoiceAction, setInvoiceStatusAction } from "@/app/(app)/billing/actions";
import { generatePayrollRunAction, setPayrollStatusAction } from "@/app/(app)/payroll/actions";
import type { SessionUser } from "@/lib/auth";
import { CLIENT_TYPE_LABELS, clientName, type ClientTypeKey } from "@/lib/clients";
import { daysUntil, expiryState } from "@/lib/compliance";
import { unavailableReason } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { isBookable, onboardingProgress, onboardingSteps } from "@/lib/onboarding";
import { canAccess } from "@/lib/permissions";
import { absoluteUrl } from "@/lib/url";
import { safeNextPath } from "@/lib/utils";

import { runFormAction, runStateAction, type ActionOutcome } from "./bridge";
import { TOOL_GROUPS, isAllowed } from "./policy";
import { bool, date, dateTime, id, idList, int, num, oneOf, optional, shape, str } from "./schema";

export interface ToolContext {
  user: SessionUser;
}

type Shape = ReturnType<typeof shape>;

export interface AssistTool<S extends Shape = Shape> {
  name: string;
  description: string;
  /** read: runs straight away. write: needs the user's confirmation. client: handled in the browser. */
  kind: "read" | "write" | "client";
  /** Most restrictive route this tool touches; checked with canAccess(). */
  route: string;
  input: S;
  /** Plain-English line shown on the confirmation card for write tools. */
  describe?: (input: z.infer<S["zod"]>, ctx: ToolContext) => Promise<string>;
  run: (input: z.infer<S["zod"]>, ctx: ToolContext) => Promise<unknown>;
}

function tool<S extends Shape>(t: AssistTool<S>): AssistTool<Shape> {
  return t as unknown as AssistTool<Shape>;
}

// ---------------------------------------------------------------------------
// Formatting helpers: compact, human-readable values for Claude to relay.

const when = (d: Date) => format(d, "EEE d MMM yyyy, HH:mm");
const day = (d: Date) => format(d, "EEE d MMM yyyy");
const money = (v: { toString(): string } | number | null | undefined) =>
  v == null ? null : `£${Number(v.toString()).toFixed(2)}`;
const person = (p: { firstName: string; lastName: string } | null | undefined) =>
  p ? `${p.firstName} ${p.lastName}` : null;
const parseLocal = (value: string) => new Date(value.length === 10 ? `${value}T00:00:00` : value);

function outcome(result: ActionOutcome, verified: Record<string, unknown> | null, fallbackError: string) {
  if (result.error) return { ok: false, error: result.error };
  if (verified === null) return { ok: false, error: fallbackError };
  return { ok: true, ...verified };
}

async function ownedShift(ctx: ToolContext, shiftId: string) {
  return prisma.shift.findFirst({
    where: { id: shiftId, agencyId: ctx.user.agencyId },
    include: { client: true, site: true, staff: true },
  });
}

async function ownedStaff(ctx: ToolContext, staffId: string) {
  return prisma.staffProfile.findFirst({ where: { id: staffId, agencyId: ctx.user.agencyId } });
}

async function ownedClient(ctx: ToolContext, clientId: string) {
  return prisma.client.findFirst({ where: { id: clientId, agencyId: ctx.user.agencyId } });
}

function shiftLabel(s: {
  title: string;
  startAt: Date;
  endAt: Date;
  client?: Parameters<typeof clientName>[0];
}) {
  return `${s.title}${s.client ? ` at ${clientName(s.client)}` : ""}, ${when(s.startAt)}–${format(s.endAt, "HH:mm")}`;
}

function shiftRow(s: {
  id: string;
  title: string;
  role: string;
  status: string;
  startAt: Date;
  endAt: Date;
  chargeRate: { toString(): string };
  isSleepIn: boolean;
  client: Parameters<typeof clientName>[0] | null;
  site: { name: string } | null;
  staff: { firstName: string; lastName: string } | null;
}) {
  return {
    id: s.id,
    title: s.title,
    role: s.role,
    client: s.client ? clientName(s.client) : null,
    unit: s.site?.name ?? null,
    start: when(s.startAt),
    end: when(s.endAt),
    carer: person(s.staff),
    status: s.status,
    charge: s.isSleepIn ? "sleep-in (flat)" : `${money(s.chargeRate)}/h`,
  };
}

/** Carers already booked at an overlapping time. */
async function clashesFor(ctx: ToolContext, staffId: string, startAt: Date, endAt: Date, excludeShiftId?: string) {
  return prisma.shift.findMany({
    where: {
      agencyId: ctx.user.agencyId,
      staffId,
      id: excludeShiftId ? { not: excludeShiftId } : undefined,
      status: { in: ["ASSIGNED", "IN_PROGRESS"] },
      startAt: { lt: endAt },
      endAt: { gt: startAt },
    },
    include: { client: true },
  });
}

function complianceWarnings(s: {
  dbsNumber: string | null;
  dbsExpiry: Date | null;
  rightToWork: { status: string; expiryDate: Date | null } | null;
}) {
  const warnings: string[] = [];
  if (!s.dbsNumber) warnings.push("no DBS certificate on file");
  else if (expiryState(s.dbsExpiry) === "EXPIRED") warnings.push("DBS certificate has expired");
  if (!s.rightToWork) warnings.push("no right-to-work check recorded");
  else if (s.rightToWork.status !== "VERIFIED") warnings.push("right to work not yet verified");
  else if (s.rightToWork.expiryDate && expiryState(s.rightToWork.expiryDate) === "EXPIRED")
    warnings.push("right to work has expired");
  return warnings;
}

// ---------------------------------------------------------------------------
// Read tools

const readTools = [
  tool({
    name: "search_records",
    kind: "read",
    route: "/oversight",
    description:
      "Find workers, clients, shifts and invoices by name or keyword. Use this first to turn a name the user mentions into an id.",
    input: shape({ query: str("Name or keyword, at least 2 characters", 80) }),
    run: async ({ query }) => ({ results: await searchAction(query) }),
  }),

  tool({
    name: "get_overview",
    kind: "read",
    route: "/oversight",
    description:
      "Today's operational snapshot: shifts today, open and unfilled shifts in the next 7 days, timesheets and shift requests awaiting a decision, unattended shifts and compliance items expiring soon. Admins also get receivables and the latest pay run.",
    input: shape({}),
    run: async (_input, { user }) => {
      const now = new Date();
      const agencyId = user.agencyId;
      const [today, unfilled, pendingTimesheets, pendingRequests, unattended, expiringDbs] = await Promise.all([
        prisma.shift.count({
          where: { agencyId, startAt: { gte: startOfDay(now), lte: endOfDay(now) }, status: { not: "CANCELLED" } },
        }),
        prisma.shift.count({
          where: { agencyId, status: "OPEN", staffId: null, startAt: { gte: now, lte: addDays(now, 7) } },
        }),
        prisma.timesheet.count({ where: { agencyId, status: "PENDING" } }),
        prisma.shiftRequest.count({ where: { agencyId, status: "PENDING" } }),
        prisma.shift.count({ where: { agencyId, status: "UNATTENDED" } }),
        prisma.staffProfile.count({
          where: { agencyId, status: "ACTIVE", dbsExpiry: { lte: addDays(now, 30) } },
        }),
      ]);
      const overview: Record<string, unknown> = {
        date: day(now),
        shiftsToday: today,
        unfilledNext7Days: unfilled,
        timesheetsAwaitingApproval: pendingTimesheets,
        shiftRequestsAwaitingDecision: pendingRequests,
        unattendedShifts: unattended,
        dbsExpiredOrExpiringWithin30Days: expiringDbs,
      };
      if (user.role === "ADMIN") {
        const [issued, latestRun] = await Promise.all([
          prisma.invoice.findMany({ where: { agencyId, status: "ISSUED" }, select: { grandTotal: true, dueDate: true } }),
          prisma.payrollRun.findFirst({ where: { agencyId }, orderBy: { createdAt: "desc" } }),
        ]);
        overview.receivables = {
          openInvoices: issued.length,
          outstanding: money(issued.reduce((sum, i) => sum + Number(i.grandTotal), 0)),
          overdue: issued.filter((i) => i.dueDate && i.dueDate < now).length,
        };
        overview.latestPayRun = latestRun
          ? { id: latestRun.id, reference: latestRun.reference, status: latestRun.status, payDate: day(latestRun.payDate) }
          : null;
      }
      return overview;
    },
  }),

  tool({
    name: "list_shifts",
    kind: "read",
    route: "/shifts",
    description:
      "List shifts, soonest first, filtered by status, date range, client, carer or unfilled only. Defaults to the next 14 days.",
    input: shape({
      status: optional(
        oneOf(["OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "UNATTENDED", "DRAFT"], "Shift status"),
      ),
      from: optional(date("Start of range, default today")),
      to: optional(date("End of range, default 14 days from the start")),
      clientId: optional(id("Only this client")),
      staffId: optional(id("Only this carer")),
      unfilledOnly: optional(bool("Only shifts with no carer assigned")),
      limit: optional(int("Max rows, default 25", 1, 100)),
    }),
    run: async (input, { user }) => {
      const from = input.from ? parseLocal(input.from) : startOfDay(new Date());
      const to = input.to ? endOfDay(parseLocal(input.to)) : endOfDay(addDays(from, 14));
      const shifts = await prisma.shift.findMany({
        where: {
          agencyId: user.agencyId,
          startAt: { gte: from, lte: to },
          ...(input.status ? { status: input.status } : {}),
          ...(input.clientId ? { clientId: input.clientId } : {}),
          ...(input.staffId ? { staffId: input.staffId } : {}),
          ...(input.unfilledOnly ? { staffId: null, status: { in: ["OPEN", "UNATTENDED"] } } : {}),
        },
        include: { client: true, site: true, staff: true },
        orderBy: { startAt: "asc" },
        take: input.limit ?? 25,
      });
      return { range: `${day(from)} – ${day(to)}`, count: shifts.length, shifts: shifts.map(shiftRow) };
    },
  }),

  tool({
    name: "get_shift",
    kind: "read",
    route: "/shifts",
    description: "Full detail for one shift, including its timesheet, offers made and carers who requested it.",
    input: shape({ shiftId: id("Shift id") }),
    run: async ({ shiftId }, { user }) => {
      const shift = await prisma.shift.findFirst({
        where: { id: shiftId, agencyId: user.agencyId },
        include: {
          client: true,
          site: true,
          staff: true,
          timesheet: true,
          shiftOffers: { include: { staff: true } },
          shiftRequests: { include: { staff: true } },
        },
      });
      if (!shift) return { error: "Shift not found" };
      return {
        ...shiftRow(shift),
        breakMins: shift.breakMins,
        sleepIn: shift.isSleepIn
          ? { carerAllowance: money(shift.sleepInRate), clientCharge: money(shift.sleepInCharge ?? shift.sleepInRate) }
          : null,
        notes: shift.notes,
        timesheet: shift.timesheet
          ? {
              id: shift.timesheet.id,
              status: shift.timesheet.status,
              workedHours: +(shift.timesheet.workedMins / 60).toFixed(2),
              clientSignedBy: shift.timesheet.clientAuthName,
            }
          : null,
        offers: shift.shiftOffers.map((o) => ({ id: o.id, carer: person(o.staff), status: o.status })),
        requests: shift.shiftRequests.map((r) => ({ id: r.id, carer: person(r.staff), status: r.status })),
        url: `/shifts/${shift.id}`,
      };
    },
  }),

  tool({
    name: "find_available_workers",
    kind: "read",
    route: "/dispatch",
    description:
      "For a shift, list active carers who are free at that time, best matches first: same job title as the shift role, then compliance status. Use before assigning or offering a shift.",
    input: shape({ shiftId: id("Shift id"), limit: optional(int("Max rows, default 10", 1, 50)) }),
    run: async ({ shiftId, limit }, ctx) => {
      const shift = await ownedShift(ctx, shiftId);
      if (!shift) return { error: "Shift not found" };
      const staff = await prisma.staffProfile.findMany({
        where: { agencyId: ctx.user.agencyId, status: "ACTIVE" },
        include: {
          rightToWork: true,
          shifts: {
            where: {
              status: { in: ["ASSIGNED", "IN_PROGRESS"] },
              startAt: { lt: shift.endAt },
              endAt: { gt: shift.startAt },
            },
            select: { id: true },
          },
        },
      });
      const role = shift.role.trim().toLowerCase();
      const free = staff
        .filter((s) => s.shifts.length === 0)
        .map((s) => {
          const warnings = complianceWarnings(s);
          return {
            staffId: s.id,
            name: person(s),
            jobTitle: s.jobTitle,
            roleMatch: s.jobTitle.trim().toLowerCase() === role,
            compliant: warnings.length === 0,
            warnings,
          };
        })
        .sort((a, b) => Number(b.roleMatch) - Number(a.roleMatch) || Number(b.compliant) - Number(a.compliant));
      return { shift: shiftLabel(shift), available: free.slice(0, limit ?? 10), totalAvailable: free.length };
    },
  }),

  tool({
    name: "list_workers",
    kind: "read",
    route: "/staff",
    description: "List carers, optionally filtered by status or a name / job title query.",
    input: shape({
      status: optional(oneOf(["ACTIVE", "INACTIVE", "ON_LEAVE"], "Worker status, default ACTIVE")),
      query: optional(str("Name, email or job title contains", 80)),
      limit: optional(int("Max rows, default 50", 1, 200)),
    }),
    run: async (input, { user }) => {
      const contains = input.query ? { contains: input.query, mode: "insensitive" as const } : undefined;
      const staff = await prisma.staffProfile.findMany({
        where: {
          agencyId: user.agencyId,
          status: input.status ?? "ACTIVE",
          ...(contains
            ? { OR: [{ firstName: contains }, { lastName: contains }, { email: contains }, { jobTitle: contains }] }
            : {}),
        },
        orderBy: [{ lastName: "asc" }],
        take: input.limit ?? 50,
      });
      return {
        count: staff.length,
        workers: staff.map((s) => ({
          id: s.id,
          name: person(s),
          jobTitle: s.jobTitle,
          status: s.status,
          phone: s.phone,
          email: s.email,
          engagement: s.engagementType,
        })),
      };
    },
  }),

  tool({
    name: "get_worker",
    kind: "read",
    route: "/staff",
    description:
      "One carer's profile: contact details, pay rates, compliance (DBS, right to work, training), onboarding progress and upcoming shifts. Never reveals bank or NI numbers.",
    input: shape({ staffId: id("Worker (staff) id") }),
    run: async ({ staffId }, { user }) => {
      const s = await prisma.staffProfile.findFirst({
        where: { id: staffId, agencyId: user.agencyId },
        include: {
          rightToWork: true,
          trainingRecords: true,
          onboardingForms: true,
          shifts: {
            where: { startAt: { gte: new Date() }, status: { not: "CANCELLED" } },
            include: { client: true, site: true, staff: true },
            orderBy: { startAt: "asc" },
            take: 10,
          },
        },
      });
      if (!s) return { error: "Worker not found" };
      const steps = onboardingSteps(s);
      return {
        id: s.id,
        name: person(s),
        jobTitle: s.jobTitle,
        status: s.status,
        email: s.email,
        phone: s.phone,
        engagement: s.engagementType,
        pay: { base: money(s.baseRate), night: money(s.nightRate), weekend: money(s.weekendRate), bankHoliday: money(s.bankHolidayRate) },
        payrollDetails: { niNumberOnFile: !!s.niNumber, bankDetailsOnFile: !!(s.sortCode && s.bankAcct) },
        dbs: s.dbsNumber
          ? { onFile: true, expiry: s.dbsExpiry ? day(s.dbsExpiry) : null, state: expiryState(s.dbsExpiry) }
          : { onFile: false },
        rightToWork: s.rightToWork
          ? { status: s.rightToWork.status, expiry: s.rightToWork.expiryDate ? day(s.rightToWork.expiryDate) : null }
          : null,
        training: s.trainingRecords.map((t) => ({
          course: t.courseName,
          status: t.status,
          expiry: t.expiryDate ? day(t.expiryDate) : null,
        })),
        onboarding: {
          progressPct: onboardingProgress(steps),
          readyToBook: isBookable(steps),
          steps: steps.map((st) => `${st.label}: ${st.detail}`),
        },
        workersAppInvited: !!s.userId,
        upcomingShifts: s.shifts.map(shiftRow),
        url: `/staff/${s.id}`,
      };
    },
  }),

  tool({
    name: "list_clients",
    kind: "read",
    route: "/clients",
    description: "List the care homes and domiciliary providers the agency supplies, with setup status.",
    input: shape({ includeFormer: optional(bool("Include former clients")) }),
    run: async ({ includeFormer }, { user }) => {
      const clients = await prisma.client.findMany({
        where: { agencyId: user.agencyId, ...(includeFormer ? {} : { status: { not: "DISCHARGED" } }) },
        include: { _count: { select: { sites: true, rates: true, contacts: { where: { isSignatory: true } } } } },
        orderBy: { name: "asc" },
      });
      return {
        clients: clients.map((c) => ({
          id: c.id,
          name: clientName(c),
          type: CLIENT_TYPE_LABELS[c.type as ClientTypeKey],
          status: c.status,
          postcode: c.postcode,
          units: c._count.sites,
          signatories: c._count.contacts,
          rateCardLines: c._count.rates,
        })),
      };
    },
  }),

  tool({
    name: "get_client",
    kind: "read",
    route: "/clients",
    description: "One client's details: units/branches (with ids), contacts and signatories (with ids), and rate card.",
    input: shape({ clientId: id("Client id") }),
    run: async ({ clientId }, { user }) => {
      const c = await prisma.client.findFirst({
        where: { id: clientId, agencyId: user.agencyId },
        include: { sites: true, contacts: true, rates: { include: { site: true } } },
      });
      if (!c) return { error: "Client not found" };
      return {
        id: c.id,
        name: clientName(c),
        type: CLIENT_TYPE_LABELS[c.type as ClientTypeKey],
        status: c.status,
        address: [c.address, c.postcode].filter(Boolean).join(", ") || null,
        invoiceEmail: c.email,
        paymentTermsDays: c.paymentTermsDays,
        frameworkRef: c.frameworkRef,
        units: c.sites.map((s) => ({ id: s.id, name: s.name, notes: s.notes })),
        contacts: c.contacts.map((p) => ({
          id: p.id,
          name: p.name,
          jobTitle: p.jobTitle,
          email: p.email,
          signsTimesheets: p.isSignatory,
          receivesInvoices: p.isAccounts,
        })),
        rateCard: c.rates.map((r) => ({
          role: r.role,
          appliesTo: r.site?.name ?? "whole client",
          day: money(r.dayRate),
          night: money(r.nightRate),
          weekend: money(r.weekendRate),
          bankHoliday: money(r.bankHolidayRate),
          sleepInCharge: money(r.sleepInCharge),
        })),
        url: `/clients/${c.id}`,
      };
    },
  }),

  tool({
    name: "list_timesheets",
    kind: "read",
    route: "/timesheets",
    description: "List timesheets by status (default PENDING, i.e. awaiting approval), most recent first.",
    input: shape({
      status: optional(oneOf(["PENDING", "APPROVED", "REJECTED", "DISPUTED"], "Timesheet status")),
      limit: optional(int("Max rows, default 25", 1, 100)),
    }),
    run: async ({ status, limit }, { user }) => {
      const rows = await prisma.timesheet.findMany({
        where: { agencyId: user.agencyId, status: status ?? "PENDING" },
        include: { staff: true, shift: { include: { client: true } } },
        orderBy: { clockIn: "desc" },
        take: limit ?? 25,
      });
      return {
        timesheets: rows.map((t) => ({
          id: t.id,
          carer: person(t.staff),
          shift: shiftLabel(t.shift),
          workedHours: +(t.workedMins / 60).toFixed(2),
          status: t.status,
          carerSigned: !!t.candidateSignedAt,
          clientSignedBy: t.clientAuthName,
        })),
      };
    },
  }),

  tool({
    name: "list_shift_requests",
    kind: "read",
    route: "/dispatch",
    description: "Carers' pending requests to work open shifts (from the Workers app), awaiting approve or reject.",
    input: shape({}),
    run: async (_input, { user }) => {
      const rows = await prisma.shiftRequest.findMany({
        where: { agencyId: user.agencyId, status: "PENDING" },
        include: { staff: true, shift: { include: { client: true } } },
        orderBy: { createdAt: "asc" },
      });
      return {
        requests: rows.map((r) => ({
          id: r.id,
          carer: person(r.staff),
          staffId: r.staffId,
          shiftId: r.shiftId,
          shift: shiftLabel(r.shift),
          message: r.message,
        })),
      };
    },
  }),

  tool({
    name: "compliance_alerts",
    kind: "read",
    route: "/compliance",
    description: "Active carers with DBS, right-to-work or training that is missing, expired or expiring soon.",
    input: shape({ withinDays: optional(int("Look-ahead window in days, default 30", 1, 365)) }),
    run: async ({ withinDays }, { user }) => {
      const window = withinDays ?? 30;
      const now = new Date();
      const staff = await prisma.staffProfile.findMany({
        where: { agencyId: user.agencyId, status: "ACTIVE" },
        include: { rightToWork: true, trainingRecords: true },
      });
      const alerts: { staffId: string; carer: string | null; item: string; state: string }[] = [];
      const check = (s: (typeof staff)[number], item: string, expiry: Date | null, missing: boolean) => {
        if (missing) return alerts.push({ staffId: s.id, carer: person(s), item, state: "missing" });
        if (!expiry) return;
        const days = daysUntil(expiry, now);
        if (days < 0) alerts.push({ staffId: s.id, carer: person(s), item, state: `expired ${-days} days ago` });
        else if (days <= window) alerts.push({ staffId: s.id, carer: person(s), item, state: `expires in ${days} days` });
      };
      for (const s of staff) {
        check(s, "DBS", s.dbsExpiry, !s.dbsNumber);
        check(s, "Right to work", s.rightToWork?.expiryDate ?? null, !s.rightToWork);
        for (const t of s.trainingRecords) check(s, `Training: ${t.courseName}`, t.expiryDate, false);
      }
      return { withinDays: window, count: alerts.length, alerts };
    },
  }),

  tool({
    name: "list_rota_templates",
    kind: "read",
    route: "/rota",
    description: "Recurring rota templates (a usual week of shifts) with their lines, for generating a week.",
    input: shape({}),
    run: async (_input, { user }) => {
      const templates = await prisma.rotaTemplate.findMany({
        where: { agencyId: user.agencyId },
        include: { lines: { include: { client: true } } },
      });
      return {
        templates: templates.map((t) => ({
          id: t.id,
          title: t.title,
          lines: t.lines.length,
          clients: [...new Set(t.lines.map((l) => (l.client ? clientName(l.client) : null)).filter(Boolean))],
        })),
      };
    },
  }),

  tool({
    name: "list_invoices",
    kind: "read",
    route: "/billing",
    description: "Client invoices with totals, due dates and days overdue. Admin only.",
    input: shape({
      status: optional(oneOf(["DRAFT", "ISSUED", "PAID", "VOID"], "Invoice status")),
      clientId: optional(id("Only this client")),
      limit: optional(int("Max rows, default 25", 1, 100)),
    }),
    run: async ({ status, clientId, limit }, { user }) => {
      const now = new Date();
      const invoices = await prisma.invoice.findMany({
        where: { agencyId: user.agencyId, ...(status ? { status } : {}), ...(clientId ? { clientId } : {}) },
        include: { client: true },
        orderBy: { createdAt: "desc" },
        take: limit ?? 25,
      });
      return {
        invoices: invoices.map((i) => ({
          id: i.id,
          reference: i.reference,
          client: clientName(i.client),
          status: i.status,
          total: money(i.grandTotal),
          margin: money(i.marginTotal),
          period: `${day(i.periodStart)} – ${day(i.periodEnd)}`,
          due: i.dueDate ? day(i.dueDate) : null,
          daysOverdue: i.status === "ISSUED" && i.dueDate && i.dueDate < now ? -daysUntil(i.dueDate, now) : 0,
          url: `/billing/${i.id}`,
        })),
      };
    },
  }),

  tool({
    name: "list_payroll_runs",
    kind: "read",
    route: "/payroll",
    description: "Recent pay runs with status and totals. Admin only.",
    input: shape({}),
    run: async (_input, { user }) => {
      const runs = await prisma.payrollRun.findMany({
        where: { agencyId: user.agencyId },
        include: { _count: { select: { payslips: true } } },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      return {
        runs: runs.map((r) => ({
          id: r.id,
          reference: r.reference,
          status: r.status,
          period: `${day(r.periodStart)} – ${day(r.periodEnd)}`,
          payDate: day(r.payDate),
          payslips: r._count.payslips,
          url: `/payroll/${r.id}`,
        })),
      };
    },
  }),
];

// ---------------------------------------------------------------------------
// Write tools: always confirmed by the user, always run through the app's own
// server actions, and verified afterwards because many actions fail silently.

const writeTools = [
  tool({
    name: "create_shift",
    kind: "write",
    route: "/shifts",
    description:
      "Create a shift. Leave chargeRate out to price it from the client's rate card. Optionally assign a carer straight away (check find_available_workers first).",
    input: shape({
      clientId: optional(id("Client id")),
      siteId: optional(id("Unit/branch id belonging to that client")),
      role: str("Role required, e.g. Care Assistant", 80),
      startAt: dateTime("Start"),
      endAt: dateTime("End; earlier than start means it ends the next day"),
      title: optional(str("Shift title; defaults to role and unit", 120)),
      breakMins: optional(int("Unpaid break in minutes", 0, 480)),
      chargeRate: optional(num("Hourly charge to the client in £; omit to use the rate card", 0, 1000)),
      staffId: optional(id("Carer to assign")),
      isSleepIn: optional(bool("Sleep-in shift")),
      sleepInRate: optional(num("Sleep-in carer allowance in £ (required for sleep-ins)", 0, 1000)),
      sleepInCharge: optional(num("Sleep-in client charge in £; omit to use the rate card", 0, 1000)),
      notes: optional(str("Notes for the carer", 1000)),
    }),
    describe: async (input, ctx) => {
      const client = input.clientId ? await ownedClient(ctx, input.clientId) : null;
      const staff = input.staffId ? await ownedStaff(ctx, input.staffId) : null;
      const start = parseLocal(input.startAt);
      return `Create a ${input.isSleepIn ? "sleep-in " : ""}${input.role} shift${client ? ` at ${clientName(client)}` : ""} on ${when(start)}–${input.endAt.slice(11)}${staff ? `, assigned to ${person(staff)}` : ", left open"}${input.chargeRate != null ? ` at £${input.chargeRate.toFixed(2)}/h` : " priced from the rate card"}`;
    },
    run: async (input, ctx) => {
      const start = parseLocal(input.startAt);
      let end = parseLocal(input.endAt);
      if (end <= start) end = addDays(end, 1);
      if (input.staffId) {
        const clashes = await clashesFor(ctx, input.staffId, start, end);
        if (clashes.length) return { ok: false, error: `That carer is already booked: ${clashes.map(shiftLabel).join("; ")}` };
        const unavailable = await unavailableReason(ctx.user.agencyId, input.staffId, start, end);
        if (unavailable) return { ok: false, error: unavailable };
      }
      const startedAt = new Date();
      const result = await runStateAction(createShiftAction, {
        clientId: input.clientId,
        siteId: input.siteId,
        staffId: input.staffId,
        role: input.role,
        title: input.title,
        startAt: format(start, "yyyy-MM-dd'T'HH:mm"),
        endAt: format(end, "yyyy-MM-dd'T'HH:mm"),
        breakMins: input.breakMins ?? 0,
        chargeRate: input.chargeRate,
        isSleepIn: input.isSleepIn,
        sleepInRate: input.sleepInRate ?? 0,
        sleepInCharge: input.sleepInCharge,
        notes: input.notes,
      });
      const created = result.error
        ? null
        : await prisma.shift.findFirst({
            where: { agencyId: ctx.user.agencyId, createdById: ctx.user.id, createdAt: { gte: startedAt }, startAt: start },
            include: { client: true, site: true, staff: true },
            orderBy: { createdAt: "desc" },
          });
      return outcome(result, created ? { shift: { ...shiftRow(created), url: `/shifts/${created.id}` } } : null, "The shift wasn't created.");
    },
  }),

  tool({
    name: "assign_shift",
    kind: "write",
    route: "/shifts",
    description: "Assign a carer to a shift. Refuses if the carer is already booked at an overlapping time.",
    input: shape({ shiftId: id("Shift id"), staffId: id("Carer (staff) id") }),
    describe: async ({ shiftId, staffId }, ctx) => {
      const [shift, staff] = await Promise.all([ownedShift(ctx, shiftId), ownedStaff(ctx, staffId)]);
      return `Assign ${person(staff) ?? "this carer"} to ${shift ? shiftLabel(shift) : "this shift"}${shift?.staff ? ` (replacing ${person(shift.staff)})` : ""}`;
    },
    run: async ({ shiftId, staffId }, ctx) => {
      const shift = await ownedShift(ctx, shiftId);
      const staff = await prisma.staffProfile.findFirst({
        where: { id: staffId, agencyId: ctx.user.agencyId },
        include: { rightToWork: true },
      });
      if (!shift || !staff) return { ok: false, error: "Shift or carer not found" };
      if (staff.status !== "ACTIVE") return { ok: false, error: `${person(staff)} isn't active (${staff.status}).` };
      const clashes = await clashesFor(ctx, staffId, shift.startAt, shift.endAt, shiftId);
      if (clashes.length) return { ok: false, error: `${person(staff)} is already booked: ${clashes.map(shiftLabel).join("; ")}` };
      const unavailable = await unavailableReason(ctx.user.agencyId, staffId, shift.startAt, shift.endAt);
      if (unavailable) return { ok: false, error: unavailable };
      const result = await runFormAction(assignShiftFormAction, { shiftId, staffId });
      const after = await ownedShift(ctx, shiftId);
      const warnings = complianceWarnings(staff);
      return outcome(
        result,
        after?.staffId === staffId ? { shift: shiftRow(after), complianceWarnings: warnings } : null,
        "The assignment didn't save.",
      );
    },
  }),

  tool({
    name: "set_shift_status",
    kind: "write",
    route: "/shifts",
    description:
      "Change a shift's status: OPEN (unassigns the carer), CANCELLED, COMPLETED, NO_SHOW or UNATTENDED (unassigns, sends to triage).",
    input: shape({
      shiftId: id("Shift id"),
      status: oneOf(["OPEN", "CANCELLED", "COMPLETED", "NO_SHOW", "UNATTENDED"], "New status"),
    }),
    describe: async ({ shiftId, status }, ctx) => {
      const shift = await ownedShift(ctx, shiftId);
      return `Mark ${shift ? shiftLabel(shift) : "this shift"} as ${status.toLowerCase().replace("_", " ")}`;
    },
    run: async ({ shiftId, status }, ctx) => {
      const result = await runFormAction(updateShiftStatusAction, { shiftId, status });
      const after = await ownedShift(ctx, shiftId);
      return outcome(result, after?.status === status ? { shift: shiftRow(after) } : null, "The status didn't change.");
    },
  }),

  tool({
    name: "offer_shift",
    kind: "write",
    route: "/dispatch",
    description: "Offer an open shift to one or more carers in the Workers app; the first to accept gets it.",
    input: shape({ shiftId: id("Shift id"), staffIds: idList("Carers to offer it to") }),
    describe: async ({ shiftId, staffIds }, ctx) => {
      const [shift, staff] = await Promise.all([
        ownedShift(ctx, shiftId),
        prisma.staffProfile.findMany({ where: { id: { in: staffIds }, agencyId: ctx.user.agencyId } }),
      ]);
      return `Offer ${shift ? shiftLabel(shift) : "this shift"} to ${staff.map(person).join(", ")}`;
    },
    run: async ({ shiftId, staffIds }, ctx) => {
      for (const staffId of staffIds) await runFormAction(offerShiftAction, { shiftId, staffId });
      const offers = await prisma.shiftOffer.findMany({
        where: { shiftId, staffId: { in: staffIds }, agencyId: ctx.user.agencyId, status: "OFFERED" },
        include: { staff: true },
      });
      return outcome({}, offers.length ? { offeredTo: offers.map((o) => person(o.staff)) } : null, "No offers were made.");
    },
  }),

  tool({
    name: "decide_shift_request",
    kind: "write",
    route: "/dispatch",
    description: "Approve (assigns the carer, declines other requests for that shift) or reject a carer's shift request.",
    input: shape({ requestId: id("Shift request id"), decision: oneOf(["approve", "reject"], "Decision") }),
    describe: async ({ requestId, decision }, ctx) => {
      const r = await prisma.shiftRequest.findFirst({
        where: { id: requestId, agencyId: ctx.user.agencyId },
        include: { staff: true, shift: { include: { client: true } } },
      });
      return `${decision === "approve" ? "Approve" : "Reject"} ${person(r?.staff) ?? "the carer"}'s request for ${r ? shiftLabel(r.shift) : "this shift"}`;
    },
    run: async ({ requestId, decision }, ctx) => {
      const result = await runFormAction(decision === "approve" ? approveShiftRequestAction : rejectShiftRequestAction, { requestId });
      const after = await prisma.shiftRequest.findFirst({ where: { id: requestId, agencyId: ctx.user.agencyId } });
      const note = result.redirectedTo?.includes("result=taken") ? "The shift had already been filled, so the request was declined." : undefined;
      return outcome(result, after && after.status !== "PENDING" ? { status: after.status, note } : null, "The request wasn't updated.");
    },
  }),

  tool({
    name: "decide_timesheet",
    kind: "write",
    route: "/timesheets",
    description: "Approve, reject or dispute a timesheet.",
    input: shape({ timesheetId: id("Timesheet id"), decision: oneOf(["APPROVED", "REJECTED", "DISPUTED"], "Decision") }),
    describe: async ({ timesheetId, decision }, ctx) => {
      const t = await prisma.timesheet.findFirst({
        where: { id: timesheetId, agencyId: ctx.user.agencyId },
        include: { staff: true, shift: { include: { client: true } } },
      });
      const verb = decision === "APPROVED" ? "Approve" : decision === "REJECTED" ? "Reject" : "Dispute";
      return `${verb} ${person(t?.staff) ?? "the"}'s timesheet${t ? ` for ${shiftLabel(t.shift)} (${(t.workedMins / 60).toFixed(2)}h)` : ""}`;
    },
    run: async ({ timesheetId, decision }, ctx) => {
      const result = await runFormAction(decideTimesheetAction, { timesheetId, decision });
      const after = await prisma.timesheet.findFirst({ where: { id: timesheetId, agencyId: ctx.user.agencyId } });
      return outcome(result, after?.status === decision ? { status: after.status } : null, "The timesheet wasn't updated.");
    },
  }),

  tool({
    name: "create_worker",
    kind: "write",
    route: "/staff",
    description: "Add a new carer. Bank, NI and tax details are best added on their profile page afterwards.",
    input: shape({
      firstName: str("First name", 80),
      lastName: str("Last name", 80),
      jobTitle: str("Job title, e.g. Care Assistant", 80),
      email: optional(str("Email", 200)),
      phone: optional(str("Phone", 40)),
      baseRate: optional(num("Hourly pay rate in £", 0, 500)),
      engagementType: optional(oneOf(["PAYE", "LTD"], "PAYE employee (default) or paid via a limited company")),
    }),
    describe: async (i) =>
      `Add ${i.firstName} ${i.lastName} as a ${i.jobTitle}${i.baseRate != null ? ` on £${i.baseRate.toFixed(2)}/h` : ""} (${i.engagementType ?? "PAYE"})`,
    run: async (input, ctx) => {
      const result = await runStateAction(createStaffAction, {
        ...input,
        engagementType: input.engagementType ?? "PAYE",
        pensionEnrolled: true,
      });
      const created = result.error
        ? null
        : await prisma.staffProfile.findFirst({
            where: { agencyId: ctx.user.agencyId, firstName: input.firstName, lastName: input.lastName },
            orderBy: { createdAt: "desc" },
          });
      return outcome(result, created ? { staffId: created.id, url: `/staff/${created.id}` } : null, "The carer wasn't added.");
    },
  }),

  tool({
    name: "set_worker_status",
    kind: "write",
    route: "/staff",
    description: "Set a carer as ACTIVE, ON_LEAVE or INACTIVE.",
    input: shape({ staffId: id("Carer id"), status: oneOf(["ACTIVE", "ON_LEAVE", "INACTIVE"], "New status") }),
    describe: async ({ staffId, status }, ctx) =>
      `Set ${person(await ownedStaff(ctx, staffId)) ?? "this carer"} to ${status.toLowerCase().replace("_", " ")}`,
    run: async ({ staffId, status }, ctx) => {
      const result = await runFormAction(setStaffStatusAction, { staffId, status });
      const after = await ownedStaff(ctx, staffId);
      return outcome(result, after?.status === status ? { status } : null, "The status didn't change.");
    },
  }),

  tool({
    name: "invite_worker_to_app",
    kind: "write",
    route: "/staff",
    description: "Send a carer their sign-in link for the Workers app (they need an email on file).",
    input: shape({ staffId: id("Carer id") }),
    describe: async ({ staffId }, ctx) => {
      const s = await ownedStaff(ctx, staffId);
      return `Invite ${person(s) ?? "this carer"} to the Workers app${s?.email ? ` at ${s.email}` : ""}`;
    },
    run: async ({ staffId }) => {
      try {
        const state = await createInviteAction({}, (() => {
          const f = new FormData();
          f.set("staffId", staffId);
          return f;
        })());
        if (state.error) return { ok: false, error: state.error };
        return state.delivered
          ? { ok: true, emailed: true }
          : { ok: true, emailed: false, link: state.link, note: "Email isn't configured; share this one-time link with the carer." };
      } catch (error) {
        return { ok: false, error: error instanceof Error ? error.message : "Invite failed" };
      }
    },
  }),

  tool({
    name: "record_dbs",
    kind: "write",
    route: "/compliance",
    description: "Record a carer's DBS certificate number and expiry/renewal date.",
    input: shape({ staffId: id("Carer id"), dbsNumber: str("DBS certificate number", 40), dbsExpiry: date("Expiry or renewal date") }),
    describe: async (i, ctx) =>
      `Record DBS ${i.dbsNumber} (expires ${day(parseLocal(i.dbsExpiry))}) for ${person(await ownedStaff(ctx, i.staffId)) ?? "this carer"}`,
    run: async (input, ctx) => {
      const result = await runFormAction(saveDbsAction, input);
      const after = await ownedStaff(ctx, input.staffId);
      return outcome(result, after?.dbsNumber === input.dbsNumber ? { saved: true } : null, "The DBS details didn't save.");
    },
  }),

  tool({
    name: "add_training",
    kind: "write",
    route: "/compliance",
    description: "Record a completed training course for a carer.",
    input: shape({
      staffId: id("Carer id"),
      courseName: str("Course, e.g. Manual Handling", 120),
      completedAt: optional(date("Completion date")),
      expiryDate: optional(date("Expiry date")),
      provider: optional(str("Provider", 120)),
    }),
    describe: async (i, ctx) =>
      `Record "${i.courseName}" training for ${person(await ownedStaff(ctx, i.staffId)) ?? "this carer"}${i.expiryDate ? `, expiring ${day(parseLocal(i.expiryDate))}` : ""}`,
    run: async (input, ctx) => {
      const before = new Date();
      const result = await runFormAction(addTrainingAction, input);
      const saved = await prisma.trainingRecord.findFirst({
        where: { staffId: input.staffId, agencyId: ctx.user.agencyId, courseName: input.courseName },
        orderBy: { id: "desc" },
      });
      return outcome(result, saved ? { saved: true, recordedAt: day(before) } : null, "The training record didn't save.");
    },
  }),

  tool({
    name: "create_client",
    kind: "write",
    route: "/clients",
    description: "Add a client organisation (care home, nursing home, domiciliary provider…).",
    input: shape({
      name: str("Organisation name", 160),
      type: oneOf(
        ["CARE_HOME", "NURSING_HOME", "DOMICILIARY_PROVIDER", "SUPPORTED_LIVING", "NHS", "LOCAL_AUTHORITY", "OTHER"],
        "Type of organisation",
      ),
      address: optional(str("Address", 200)),
      postcode: optional(str("Postcode", 12)),
      email: optional(str("Invoice email", 200)),
      phone: optional(str("Main phone", 40)),
      paymentTermsDays: optional(int("Payment terms in days, default 30", 0, 180)),
    }),
    describe: async (i) => `Add ${i.name} as a new ${CLIENT_TYPE_LABELS[i.type].toLowerCase()} client`,
    run: async (input) => {
      const result = await runStateAction(createClientAction, { ...input, paymentTermsDays: input.paymentTermsDays ?? 30 });
      const clientId = result.redirectedTo?.match(/^\/clients\/([^/?]+)/)?.[1];
      return outcome(result, clientId ? { clientId, url: `/clients/${clientId}`, next: "Add units, a signatory and a rate card." } : null, "The client wasn't added.");
    },
  }),

  tool({
    name: "add_unit",
    kind: "write",
    route: "/clients",
    description: "Add a unit/ward (care home) or branch (domiciliary provider) to a client.",
    input: shape({ clientId: id("Client id"), name: str("Unit or branch name", 120), notes: optional(str("Arrival notes for carers", 500)) }),
    describe: async (i, ctx) => `Add "${i.name}" to ${clientName(await ownedClient(ctx, i.clientId))}`,
    run: async (input, ctx) => {
      const result = await runStateAction(createSiteAction, input);
      const site = await prisma.site.findFirst({
        where: { clientId: input.clientId, agencyId: ctx.user.agencyId, name: input.name },
        orderBy: { createdAt: "desc" },
      });
      return outcome(result, site ? { siteId: site.id } : null, "The unit wasn't added.");
    },
  }),

  tool({
    name: "add_client_contact",
    kind: "write",
    route: "/clients",
    description: "Add a contact at a client. Mark canSignTimesheets only when the user says this person may authorise timesheets.",
    input: shape({
      clientId: id("Client id"),
      name: str("Contact name", 120),
      jobTitle: optional(str("Job title", 120)),
      email: optional(str("Email", 200)),
      phone: optional(str("Phone", 40)),
      canSignTimesheets: optional(bool("May authorise timesheets via Pleasant Link")),
      receivesInvoices: optional(bool("Receives invoices")),
    }),
    describe: async (i, ctx) =>
      `Add ${i.name}${i.jobTitle ? ` (${i.jobTitle})` : ""} as a contact at ${clientName(await ownedClient(ctx, i.clientId))}${i.canSignTimesheets ? ", authorised to sign timesheets" : ""}${i.receivesInvoices ? ", receives invoices" : ""}`,
    run: async (input, ctx) => {
      const result = await runStateAction(createContactAction, {
        clientId: input.clientId,
        name: input.name,
        jobTitle: input.jobTitle,
        email: input.email,
        phone: input.phone,
        isSignatory: input.canSignTimesheets,
        isAccounts: input.receivesInvoices,
      });
      const contact = await prisma.clientContact.findFirst({
        where: { clientId: input.clientId, agencyId: ctx.user.agencyId, name: input.name },
        orderBy: { createdAt: "desc" },
      });
      return outcome(result, contact ? { contactId: contact.id } : null, "The contact wasn't added.");
    },
  }),

  tool({
    name: "set_client_rate",
    kind: "write",
    route: "/clients",
    description:
      "Add or update a rate-card line: hourly charge rates for a role at a client (optionally one unit only). Blank premiums fall back to the day rate.",
    input: shape({
      clientId: id("Client id"),
      role: str("Role, e.g. Care Assistant", 80),
      dayRate: num("Day rate £/h", 0.01, 1000),
      nightRate: optional(num("Night rate £/h", 0, 1000)),
      weekendRate: optional(num("Weekend rate £/h", 0, 1000)),
      bankHolidayRate: optional(num("Bank holiday rate £/h", 0, 1000)),
      sleepInCharge: optional(num("Flat sleep-in charge £", 0, 1000)),
      siteId: optional(id("Only this unit/branch")),
    }),
    describe: async (i, ctx) => {
      const parts = [`day £${i.dayRate.toFixed(2)}`];
      if (i.nightRate != null) parts.push(`night £${i.nightRate.toFixed(2)}`);
      if (i.weekendRate != null) parts.push(`weekend £${i.weekendRate.toFixed(2)}`);
      if (i.bankHolidayRate != null) parts.push(`bank holiday £${i.bankHolidayRate.toFixed(2)}`);
      if (i.sleepInCharge != null) parts.push(`sleep-in £${i.sleepInCharge.toFixed(2)} flat`);
      return `Set the ${i.role} rate at ${clientName(await ownedClient(ctx, i.clientId))}: ${parts.join(", ")}`;
    },
    run: async (input) => {
      const result = await runStateAction(saveRateAction, {
        ...input,
        dayRate: input.dayRate,
      });
      return outcome(result, result.success ? { saved: result.success } : null, "The rate wasn't saved.");
    },
  }),

  tool({
    name: "create_pleasant_link",
    kind: "write",
    route: "/clients",
    description: "Create a 24-hour Pleasant Link for a client signatory to approve timesheets and request staff.",
    input: shape({ clientId: id("Client id"), contactId: id("Signatory contact id (from get_client)") }),
    describe: async (i, ctx) => {
      const contact = await prisma.clientContact.findFirst({ where: { id: i.contactId, agencyId: ctx.user.agencyId } });
      return `Create a Pleasant Link for ${contact?.name ?? "this signatory"} at ${clientName(await ownedClient(ctx, i.clientId))}`;
    },
    run: async ({ clientId, contactId }) => {
      const result = await createPleasantLinkAction(clientId, contactId);
      if (result.error || !result.link) return { ok: false, error: result.error ?? "No link was created" };
      return { ok: true, link: await absoluteUrl(result.link), validFor: "24 hours" };
    },
  }),

  tool({
    name: "generate_rota_week",
    kind: "write",
    route: "/rota",
    description: "Create a week of shifts from a recurring rota template. Existing identical shifts aren't duplicated.",
    input: shape({ templateId: id("Rota template id"), weekStart: date("Monday of the week to generate") }),
    describe: async (i, ctx) => {
      const t = await prisma.rotaTemplate.findFirst({ where: { id: i.templateId, agencyId: ctx.user.agencyId } });
      return `Generate the week of ${day(parseLocal(i.weekStart))} from "${t?.title ?? "this template"}"`;
    },
    run: async (input, ctx) => {
      const before = new Date();
      const result = await runFormAction(generateRotaWeekAction, input);
      const created = await prisma.shift.count({
        where: { agencyId: ctx.user.agencyId, rotaTemplateId: input.templateId, createdAt: { gte: before } },
      });
      return outcome(result, { shiftsCreated: created, note: created === 0 ? "Nothing new: shifts already existed or were before the payroll cutoff." : undefined }, "");
    },
  }),

  tool({
    name: "create_invoice",
    kind: "write",
    route: "/billing",
    description:
      "Draft an invoice for a client from approved, client-authorised timesheets in a period. Due date defaults to the client's payment terms. Admin only.",
    input: shape({
      clientId: id("Client id"),
      periodStart: date("Period start"),
      periodEnd: date("Period end"),
      dueDate: optional(date("Due date")),
      vatRatePct: optional(oneOf(["0", "20"], "VAT %, default 0")),
    }),
    describe: async (i, ctx) =>
      `Draft an invoice for ${clientName(await ownedClient(ctx, i.clientId))} covering ${day(parseLocal(i.periodStart))} – ${day(parseLocal(i.periodEnd))}`,
    run: async (input, ctx) => {
      const client = await ownedClient(ctx, input.clientId);
      if (!client) return { ok: false, error: "Client not found" };
      const due = input.dueDate ?? format(addDays(parseLocal(input.periodEnd), client.paymentTermsDays), "yyyy-MM-dd");
      const result = await runStateAction(createInvoiceAction, { ...input, dueDate: due, vatRatePct: input.vatRatePct ?? "0" });
      const invoiceId = result.redirectedTo?.match(/^\/billing\/([^/?]+)/)?.[1];
      if (!invoiceId) return outcome(result, null, "The invoice wasn't created.");
      const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, agencyId: ctx.user.agencyId } });
      return { ok: true, invoiceId, reference: inv?.reference, total: money(inv?.grandTotal), status: inv?.status, url: `/billing/${invoiceId}` };
    },
  }),

  tool({
    name: "set_invoice_status",
    kind: "write",
    route: "/billing",
    description: "Issue an invoice, mark it paid, or void it. Admin only.",
    input: shape({ invoiceId: id("Invoice id"), status: oneOf(["ISSUED", "PAID", "VOID"], "New status") }),
    describe: async ({ invoiceId, status }, ctx) => {
      const inv = await prisma.invoice.findFirst({ where: { id: invoiceId, agencyId: ctx.user.agencyId }, include: { client: true } });
      const verb = status === "ISSUED" ? "Issue" : status === "PAID" ? "Mark as paid" : "Void";
      return `${verb} invoice ${inv?.reference ?? ""}${inv ? ` to ${clientName(inv.client)} (${money(inv.grandTotal)})` : ""}`;
    },
    run: async ({ invoiceId, status }, ctx) => {
      const result = await runFormAction(setInvoiceStatusAction, { invoiceId, status });
      const after = await prisma.invoice.findFirst({ where: { id: invoiceId, agencyId: ctx.user.agencyId } });
      return outcome(result, after?.status === status ? { status } : null, "The invoice wasn't updated.");
    },
  }),

  tool({
    name: "generate_payroll_run",
    kind: "write",
    route: "/payroll",
    description: "Create a draft pay run from approved timesheets in a period. Admin only.",
    input: shape({
      periodStart: date("Pay period start"),
      periodEnd: date("Pay period end"),
      payDate: date("Pay date"),
      period: optional(oneOf(["WEEKLY", "FORTNIGHTLY", "FOUR_WEEKLY", "MONTHLY"], "Pay frequency, default the agency's")),
    }),
    describe: async (i) =>
      `Create a draft pay run for ${day(parseLocal(i.periodStart))} – ${day(parseLocal(i.periodEnd))}, paid ${day(parseLocal(i.payDate))}`,
    run: async (input, ctx) => {
      const result = await runStateAction(generatePayrollRunAction, {
        ...input,
        period: input.period ?? ctx.user.agency.payFrequency,
      });
      const runId = result.redirectedTo?.match(/^\/payroll\/([^/?]+)/)?.[1];
      return outcome(result, runId ? { runId, url: `/payroll/${runId}` } : null, "The pay run wasn't created.");
    },
  }),

  tool({
    name: "set_payroll_status",
    kind: "write",
    route: "/payroll",
    description: "Move a pay run to APPROVED, FINALISED or PAID. Admin only.",
    input: shape({ runId: id("Pay run id"), status: oneOf(["APPROVED", "FINALISED", "PAID"], "New status") }),
    describe: async ({ runId, status }, ctx) => {
      const run = await prisma.payrollRun.findFirst({ where: { id: runId, agencyId: ctx.user.agencyId } });
      return `Move pay run ${run?.reference ?? ""} to ${status.toLowerCase()}`;
    },
    run: async ({ runId, status }, ctx) => {
      const result = await runFormAction(setPayrollStatusAction, { runId, status });
      const after = await prisma.payrollRun.findFirst({ where: { id: runId, agencyId: ctx.user.agencyId } });
      return outcome(result, after?.status === status ? { status } : null, "The pay run wasn't updated.");
    },
  }),
];

// ---------------------------------------------------------------------------
// Client tool: navigation happens in the browser.

const clientTools = [
  tool({
    name: "open_page",
    kind: "client",
    route: "/oversight",
    description:
      "Open a page in the app for the user, e.g. /shifts/new, /clients/<id>, /settings/team. Use it for things you can't do directly, or when the user asks to see something.",
    input: shape({ path: str("App path starting with /", 200) }),
    run: async ({ path }, { user }) => {
      const safe = safeNextPath(path);
      if (!safe || !canAccess(user.role, safe.split("?")[0])) return { ok: false, error: "That page isn't available to you." };
      return { ok: true, opened: safe };
    },
  }),
];

export const ASSIST_TOOLS: AssistTool[] = [...readTools, ...writeTools, ...clientTools];

/** Tools this user's role may use. */
export interface ToolScope {
  /** Agency policy: groups switched off, as "<group>:read" / "<group>:write". */
  disabled?: readonly string[];
  /** Unattended runs (automations) can only read: nobody is there to confirm a change. */
  readOnly?: boolean;
}

/** Tools this user may use: their role's routes, minus the agency's Assist policy. */
export function toolsFor(role: string, scope: ToolScope = {}): AssistTool[] {
  const disabled = scope.disabled ?? [];
  return ASSIST_TOOLS.filter((t) => {
    if (!canAccess(role, t.route)) return false;
    if (scope.readOnly && t.kind !== "read") return false;
    return isAllowed(disabled, TOOL_GROUPS[t.name] ?? "general", t.kind === "write" ? "write" : "read");
  });
}

export function findTool(role: string, name: string, scope: ToolScope = {}): AssistTool | undefined {
  return toolsFor(role, scope).find((t) => t.name === name);
}
