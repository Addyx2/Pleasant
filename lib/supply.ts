import { addDays, endOfDay, startOfDay } from "date-fns";
import { after } from "next/server";

import { clientName, resolveChargeRate, toRateCardEntry } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { reportShiftCompleted } from "@/lib/elements-sync";
import { agencyBankHolidays } from "@/lib/integrations/bank-holidays";

// Supply: what a client (a care home, or any team that books carers) does
// with the agency. Shared by the Aultrum Link portal and the Supply API that
// Aultrum Workspace calls.

export interface Signer {
  name: string;
  position: string;
  /** Where the signature came from, stored on the timesheet as evidence. */
  evidence: string;
}

export type SupplyResult = { ok: true; message?: string } | { ok: false; error: string };

/** The client's authorised person signs off a timesheet, which approves it. */
export async function signOffAsClient(agencyId: string, clientId: string, timesheetId: string, signer: Signer): Promise<SupplyResult> {
  const timesheet = await prisma.timesheet.findFirst({ where: { id: timesheetId, agencyId }, include: { shift: true } });
  if (!timesheet || timesheet.shift.clientId !== clientId) return { ok: false, error: "That timesheet isn't one of yours." };
  if (timesheet.status !== "PENDING") return { ok: false, error: "This timesheet has already been decided." };
  if (!timesheet.clockOut) return { ok: false, error: "This shift hasn't finished yet." };

  await prisma.timesheet.update({
    where: { id: timesheetId },
    data: { status: "APPROVED", clientAuthName: signer.name, clientAuthPosition: signer.position, clientAuthAt: new Date(), clientAuthSignature: signer.evidence },
  });
  await prisma.shift.update({ where: { id: timesheet.shiftId }, data: { status: "COMPLETED" } });
  after(() => reportShiftCompleted(agencyId, timesheetId));
  await prisma.agentLog.create({
    data: { agencyId, agentName: "CLIENTPOINT", action: "TIMESHEET_SIGNOFF", details: `${signer.name} (${signer.position}) signed off Timesheet ${timesheetId}.`, status: "SUCCESS" },
  });
  return { ok: true, message: "Signed off." };
}

export interface StaffRequest {
  role: string;
  startAt: Date;
  endAt: Date;
  /** How many carers, each an open shift. */
  count?: number;
  notes?: string | null;
  requestedBy?: string | null;
}

/** A client asks for staff: open shifts, priced from their rate card, for the agency to fill. */
export async function requestStaff(agencyId: string, clientId: string, req: StaffRequest): Promise<SupplyResult & { shiftIds?: string[] }> {
  if (!(req.endAt > req.startAt)) return { ok: false, error: "The shift must end after it starts." };
  if (req.endAt.getTime() - req.startAt.getTime() > 24 * 3_600_000) return { ok: false, error: "A shift can be at most 24 hours." };
  if (req.startAt < new Date(Date.now() - 3_600_000)) return { ok: false, error: "That time has passed." };
  const count = Math.min(Math.max(req.count ?? 1, 1), 10);
  const rates = await prisma.clientRate.findMany({ where: { clientId } });
  const resolved = resolveChargeRate(rates.map(toRateCardEntry), { role: req.role, startAt: req.startAt, endAt: req.endAt }, await agencyBankHolidays(agencyId));
  const notes = [req.notes?.trim(), req.requestedBy ? `Requested by ${req.requestedBy}` : null].filter(Boolean).join(" · ") || null;

  const shifts = await prisma.$transaction(
    Array.from({ length: count }, () =>
      prisma.shift.create({
        data: { agencyId, clientId, title: `${REQUEST_PREFIX}${req.role}`, role: req.role, startAt: req.startAt, endAt: req.endAt, chargeRate: resolved?.rate ?? 0, status: "OPEN", notes },
        select: { id: true },
      }),
    ),
  );
  await prisma.agentLog.create({
    data: { agencyId, agentName: "CLIENTPOINT", action: "SHIFT_REQUEST_SUBMITTED", details: `Client requested ${count} × ${req.role} (${shifts.map((s) => s.id).join(", ")}).`, status: "SUCCESS" },
  });
  return { ok: true, message: count === 1 ? "Requested." : `${count} shifts requested.`, shiftIds: shifts.map((s) => s.id) };
}

export const REQUEST_PREFIX = "Client Request: ";

/**
 * The client takes back a request that hasn't been filled (e.g. another
 * supplier filled it). Open offers and carers' requests for it close too.
 */
export async function cancelRequest(agencyId: string, clientId: string, shiftId: string, by: string | null): Promise<SupplyResult> {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, agencyId, clientId }, select: { id: true, title: true, status: true, staffId: true, notes: true } });
  if (!shift || !shift.title.startsWith(REQUEST_PREFIX)) return { ok: false, error: "That isn't one of your requests." };
  if (shift.status === "CANCELLED") return { ok: true, message: "Already cancelled." };
  if (shift.staffId || shift.status !== "OPEN") return { ok: false, error: "A carer is already booked for this. Ask the agency to change it." };
  await prisma.$transaction([
    prisma.shift.update({ where: { id: shift.id }, data: { status: "CANCELLED", notes: [shift.notes, by ? `Cancelled by ${by}` : "Cancelled by the client"].filter(Boolean).join(" · ") } }),
    prisma.shiftOffer.updateMany({ where: { shiftId: shift.id, status: "OFFERED" }, data: { status: "DECLINED", respondedAt: new Date() } }),
    prisma.shiftRequest.updateMany({ where: { shiftId: shift.id, status: "PENDING" }, data: { status: "WITHDRAWN" } }),
  ]);
  await prisma.agentLog.create({ data: { agencyId, agentName: "CLIENTPOINT", action: "SHIFT_REQUEST_CANCELLED", details: `Client cancelled request ${shift.id}${by ? ` (${by})` : ""}.`, status: "SUCCESS" } });
  return { ok: true, message: "Request cancelled." };
}

const person = (s: { firstName: string; lastName: string } | null) => (s ? `${s.firstName} ${s.lastName}`.trim() : null);

/** Everything a client sees about their supply from this agency, as plain JSON (Supply API v1). */
export async function supplyOverview(agencyId: string, clientId: string) {
  const now = new Date();
  const client = await prisma.client.findFirstOrThrow({ where: { id: clientId, agencyId }, include: { agency: { select: { name: true } } } });
  const [onSite, toSign, upcoming, rateRoles, invoices] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId, clientId, startAt: { gte: startOfDay(now), lte: endOfDay(now) }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      include: { staff: true, site: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.timesheet.findMany({
      where: { agencyId, status: "PENDING", clockOut: { not: null }, shift: { clientId } },
      include: { shift: true, staff: true },
      orderBy: { clockIn: "asc" },
      take: 50,
    }),
    prisma.shift.findMany({
      where: { agencyId, clientId, startAt: { gt: endOfDay(now), lte: addDays(now, 14) }, status: { in: ["OPEN", "ASSIGNED"] } },
      include: { staff: true, site: true },
      orderBy: { startAt: "asc" },
      take: 100,
    }),
    prisma.clientRate.findMany({ where: { clientId }, select: { role: true }, orderBy: { role: "asc" } }),
    // Drafts are still being prepared by the agency, so the client doesn't see them.
    prisma.invoice.findMany({ where: { agencyId, clientId, status: { not: "DRAFT" } }, orderBy: { createdAt: "desc" }, take: 12 }),
  ]);
  const shift = (s: (typeof upcoming)[number]) => ({
    id: s.id,
    title: s.title,
    role: s.role,
    site: s.site?.name ?? null,
    startAt: s.startAt.toISOString(),
    endAt: s.endAt.toISOString(),
    status: s.status,
    carer: person(s.staff),
    /** Asked for by the client, so they can cancel it while it's unfilled. */
    requested: s.title.startsWith(REQUEST_PREFIX),
  });
  return {
    agency: client.agency.name,
    client: clientName(client),
    onSite: onSite.map(shift),
    upcoming: upcoming.map(shift),
    toSign: toSign.map((t) => ({
      id: t.id,
      daysWaiting: daysSince(t.clockOut, now),
      carerSigned: Boolean(t.candidateSignedAt),
      title: t.shift.title,
      carer: person(t.staff),
      clockIn: t.clockIn.toISOString(),
      clockOut: t.clockOut?.toISOString() ?? null,
      workedMins: t.workedMins,
      breakMins: t.breakMins,
    })),
    roles: [...new Set(rateRoles.map((r) => r.role))],
    invoices: invoices.map((i) => ({
      id: i.id,
      reference: i.reference,
      status: i.status,
      periodStart: i.periodStart.toISOString(),
      periodEnd: i.periodEnd.toISOString(),
      hours: Number(i.hoursTotal),
      total: Number(i.grandTotal),
      dueDate: i.dueDate?.toISOString() ?? null,
    })),
  };
}

/** Whole days since a shift finished: the clock for sign-off reminders. */
const daysSince = (at: Date | null, now: Date) => (at ? Math.max(0, Math.floor((now.getTime() - at.getTime()) / 86_400_000)) : null);

/**
 * The client's timesheets for the last 90 days: waiting for their sign-off
 * (with how long), and signed off (by whom and when).
 */
export async function supplyTimesheets(agencyId: string, clientId: string) {
  const now = new Date();
  const rows = await prisma.timesheet.findMany({
    where: { agencyId, clockOut: { not: null, gte: addDays(now, -90) }, shift: { clientId }, status: { in: ["PENDING", "APPROVED"] } },
    include: { shift: { include: { site: true } }, staff: true },
    orderBy: { clockIn: "desc" },
    take: 300,
  });
  return {
    timesheets: rows.map((t) => {
      const signed = t.status === "APPROVED" || Boolean(t.clientAuthAt);
      return {
        id: t.id,
        title: t.shift.title,
        site: t.shift.site?.name ?? null,
        carer: person(t.staff),
        clockIn: t.clockIn.toISOString(),
        clockOut: t.clockOut?.toISOString() ?? null,
        workedMins: t.workedMins,
        breakMins: t.breakMins,
        carerSigned: Boolean(t.candidateSignedAt),
        signed,
        signedBy: t.clientAuthName,
        signedPosition: t.clientAuthPosition,
        signedAt: t.clientAuthAt?.toISOString() ?? t.approvedAt?.toISOString() ?? null,
        daysWaiting: signed ? null : daysSince(t.clockOut, now),
      };
    }),
  };
}
