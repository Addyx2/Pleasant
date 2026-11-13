import { prisma } from "@/lib/db";
import { startCampaign } from "@/lib/pushbots/campaign";

// A carer told Gateway (by phone, text or chat) that they can't make a shift.
// Pleasant frees that shift and, if the agency has a Pushbot, starts texting
// other carers to cover it straight away. The office sees what was done on
// Qualifiers and can change it.

const DAY = 86_400_000;
/** Without a date, the carer's next shift if it starts within this long. */
const NEXT_WITHIN = 2 * DAY;
const MAX_SHIFTS = 3;

const londonDate = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const label = (s: { title: string; startAt: Date }) =>
  `${s.title}, ${new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(s.startAt)}`;

export interface CoverResult {
  shifts: { shiftId: string; label: string; covering: boolean }[];
  note: string;
}

export async function coverAbsence(agencyId: string, input: { staffId: string | null; date: string | null }, now = new Date()): Promise<CoverResult> {
  const staff = input.staffId ? await prisma.staffProfile.findFirst({ where: { id: input.staffId, agencyId }, select: { id: true, firstName: true } }) : null;
  if (!staff) return { shifts: [], note: "Not matched to a carer in Pleasant: check the rota." };

  const upcoming = await prisma.shift.findMany({
    where: { agencyId, staffId: staff.id, status: "ASSIGNED", startAt: { gt: now, lt: new Date(now.getTime() + 14 * DAY) } },
    orderBy: { startAt: "asc" },
    select: { id: true, title: true, startAt: true },
  });
  const date = input.date && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null;
  const matched = date
    ? upcoming.filter((s) => londonDate(s.startAt) === date).slice(0, MAX_SHIFTS)
    : upcoming.filter((s) => s.startAt.getTime() - now.getTime() < NEXT_WITHIN).slice(0, 1);
  if (matched.length === 0) {
    return { shifts: [], note: date ? `${staff.firstName} has no upcoming shift on ${date} in Pleasant: check which shift they meant.` : `${staff.firstName} has no shift in the next two days in Pleasant: check which shift they meant.` };
  }

  const pushbot = await prisma.pushbot.findUnique({ where: { agencyId }, select: { enabled: true } });
  const shifts: CoverResult["shifts"] = [];
  for (const s of matched) {
    // Only if it's still theirs: the office may already have moved it.
    const freed = await prisma.shift.updateMany({ where: { id: s.id, agencyId, staffId: staff.id, status: "ASSIGNED" }, data: { status: "UNATTENDED", staffId: null } });
    if (freed.count === 0) continue;
    // Recorded as their answer, so the shift isn't offered straight back to them.
    await prisma.shiftOffer.upsert({
      where: { shiftId_staffId: { shiftId: s.id, staffId: staff.id } },
      create: { agencyId, shiftId: s.id, staffId: staff.id, status: "DECLINED", respondedAt: now, note: "Told Gateway they can't make it" },
      update: { status: "DECLINED", respondedAt: now },
    });
    const started = pushbot?.enabled ? await startCampaign(agencyId, s.id, null) : null;
    // Covering only if someone was actually offered it; otherwise it waits for the office.
    shifts.push({ shiftId: s.id, label: label(s), covering: Boolean(started?.ok && started.offered > 0) });
  }
  await prisma.agentLog.create({
    data: { agencyId, agentName: "GATEWAY", action: "ABSENCE_COVER", details: JSON.stringify({ staffId: staff.id, date, shifts }), status: "SUCCESS" },
  }).catch(() => undefined);

  const covering = shifts.filter((s) => s.covering).length;
  const note = shifts.length === 0
    ? "The shift had already changed: check the rota."
    : covering === shifts.length
      ? `Freed ${shifts.map((s) => s.label).join("; ")}. Pushbots is texting carers to cover it.`
      : `Freed ${shifts.map((s) => s.label).join("; ")}. No other carer could be offered it yet: it's under Unattended shifts.`;
  return { shifts, note };
}
