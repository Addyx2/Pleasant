import { prisma } from "@/lib/db";
import { sendElementEvent } from "@/lib/elements";

// Keeps Gateway's directory in step with Pleasant, so it recognises carers
// and client contacts when they call or text, and tells Peak about the
// shifts, clock-ins and praise it scores.

export function carerPerson(s: { id: string; firstName: string; lastName: string; phone: string | null }) {
  return { personId: s.id, name: `${s.firstName} ${s.lastName}`.trim(), phone: s.phone, kind: "carer" };
}

export function contactPerson(c: { id: string; name: string; phone: string | null }, organisation: string | null) {
  return { personId: `contact:${c.id}`, name: c.name, phone: c.phone, kind: "client", organisation };
}

/** Send everyone with a phone number to Gateway, e.g. when it is switched on. */
export async function syncGatewayDirectory(agencyId: string): Promise<number> {
  const [staff, contacts] = await Promise.all([
    prisma.staffProfile.findMany({ where: { agencyId, status: "ACTIVE", phone: { not: null } }, select: { id: true, firstName: true, lastName: true, phone: true } }),
    prisma.clientContact.findMany({ where: { agencyId, phone: { not: null } }, select: { id: true, name: true, phone: true, client: { select: { name: true } } } }),
  ]);
  for (const s of staff) await sendElementEvent(agencyId, "GATEWAY", "platform.person.updated", carerPerson(s));
  for (const c of contacts) await sendElementEvent(agencyId, "GATEWAY", "platform.person.updated", contactPerson(c, c.client.name));
  return staff.length + contacts.length;
}

/** A carer clocked in: Peak scores it if on time. */
export async function reportClockIn(agencyId: string, timesheetId: string) {
  const ts = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    select: { clockIn: true, shiftId: true, shift: { select: { startAt: true, title: true } }, staff: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!ts) return;
  const minutesLate = Math.max(0, Math.round((ts.clockIn.getTime() - ts.shift.startAt.getTime()) / 60_000));
  await sendElementEvent(agencyId, "PEAK", "platform.clock.in", {
    personId: ts.staff.id,
    name: `${ts.staff.firstName} ${ts.staff.lastName}`,
    shiftId: ts.shiftId,
    minutesLate,
  });
}

/** A timesheet was approved: the shift is complete, so Peak scores it. */
export async function reportShiftCompleted(agencyId: string, timesheetId: string) {
  const ts = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    select: { status: true, shiftId: true, shift: { select: { title: true } }, staff: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!ts || ts.status !== "APPROVED") return;
  await sendElementEvent(agencyId, "PEAK", "platform.shift.completed", {
    personId: ts.staff.id,
    name: `${ts.staff.firstName} ${ts.staff.lastName}`,
    shiftId: ts.shiftId,
    shiftName: ts.shift.title,
  });
}
