import { addDays, format } from "date-fns";

import { carerAppUrl, workspaceAppUrl } from "@/lib/aultrum-id";
import { generatePleasantLink } from "@/lib/clientpoint/pleasant-link";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { pleasantOrigin } from "@/lib/elements";
import { sendEmail } from "@/lib/email";

// Sign-off reminders: a timesheet still waiting for the client's signature
// 3 days after the shift ended, and again at 7, reminds the people who can
// sign it. A client on Aultrum Workspace is pointed there; any other client
// gets a one-off sign-off link for each of their signatories. A carer who
// hasn't signed their own part is reminded too. Each timesheet gets each
// reminder once (TimesheetReminder), however often this runs.

export const REMINDER_DAYS = [3, 7] as const;

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Sends the reminders that are due. Safe to run any number of times. */
export async function runSignOffReminders(now = new Date()): Promise<{ timesheets: number; emails: number }> {
  let timesheetCount = 0;
  let emails = 0;
  for (const day of REMINDER_DAYS) {
    // Due: ended at least `day` days ago (but not so long ago that a later
    // reminder is due instead), still waiting, and not reminded for this day.
    const later = REMINDER_DAYS.find((d) => d > day);
    const due = await prisma.timesheet.findMany({
      where: {
        status: "PENDING",
        clientAuthAt: null,
        clockOut: { lte: addDays(now, -day), ...(later ? { gt: addDays(now, -later) } : { gt: addDays(now, -30) }) },
        reminders: { none: { day } },
        shift: { clientId: { not: null } },
      },
      include: { staff: true, shift: { include: { client: { include: { contacts: true, agency: true } } } } },
      take: 300,
    });

    // One email per client (and per carer), listing all their waiting timesheets.
    const byClient = new Map<string, typeof due>();
    for (const t of due) byClient.set(t.shift.clientId!, [...(byClient.get(t.shift.clientId!) ?? []), t]);

    for (const [clientId, sheets] of byClient) {
      const client = sheets[0].shift.client!;
      const agency = client.agency.name;
      const home = clientName(client);
      const lines = sheets.map((t) => `- ${t.staff.firstName} ${t.staff.lastName}: ${t.shift.title}, ${format(t.clockIn, "EEE d MMM")}`).join("\n");
      const signatories = client.contacts.filter((c) => c.isSignatory && c.email);
      const sentTo = new Map<string, string[]>(sheets.map((t) => [t.id, []]));
      let delivered = false;

      for (const contact of signatories) {
        let where: string;
        if (client.aultrumBuyerId) {
          where = `Sign them in Aultrum Workspace: ${workspaceAppUrl()}/supply/timesheets`;
        } else {
          const link = await generatePleasantLink(client.agencyId, clientId, contact.id, 72);
          where = `Sign them here (no login needed; the link works for 3 days): ${pleasantOrigin()}/pleasant-link/${link.token}`;
        }
        const result = await sendEmail({
          to: contact.email!,
          subject: `${plural(sheets.length, "timesheet")} from ${agency} waiting ${day} days for your sign-off`,
          text: `Hello ${contact.name},\n\nThese shifts at ${home} ended ${day} days ago and are waiting for your signature:\n\n${lines}\n\n${where}\n\nSigning confirms the carers worked these hours. ${agency} invoices from signed timesheets.\n\n${agency}, via Pleasant`,
        });
        if (result.delivered) {
          delivered = true;
          emails++;
        }
        for (const t of sheets) sentTo.get(t.id)!.push(contact.name);
      }

      // Carers who haven't signed their own part.
      for (const t of sheets.filter((s) => !s.candidateSignedAt && s.staff.email)) {
        const result = await sendEmail({
          to: t.staff.email!,
          subject: `Sign your timesheet: ${t.shift.title}, ${format(t.clockIn, "d MMM")}`,
          text: `Hello ${t.staff.firstName},\n\nYour shift at ${home} on ${format(t.clockIn, "EEEE d MMMM")} ended ${day} days ago and your timesheet isn't signed yet. Sign it in the Aultrum app: ${carerAppUrl()}/timesheets\n\nUnsigned timesheets can't be paid.\n\n${agency}`,
        });
        if (result.delivered) emails++;
        sentTo.get(t.id)!.push("carer");
      }

      for (const t of sheets) {
        const to = sentTo.get(t.id)!;
        await prisma.timesheetReminder.createMany({
          data: [{ timesheetId: t.id, day, sentTo: to.length ? to.join(", ") : "no one with an email", delivered }],
          skipDuplicates: true,
        });
        timesheetCount++;
      }
    }
  }
  return { timesheets: timesheetCount, emails };
}

const LAST_RUN = "sign-off-reminders-last-run";

/**
 * Runs the reminders at most once an hour, triggered by the app being used,
 * so they go out without a scheduler to set up. A daily cron also calls them.
 */
export async function maybeRunSignOffReminders(now = new Date()): Promise<void> {
  try {
    const last = await prisma.serviceKey.findUnique({ where: { name: LAST_RUN } });
    if (last && now.getTime() - Number(last.value) < 3_600_000) return;
    // Claim this run; if another server claimed it first, leave it to them.
    if (last) {
      const claimed = await prisma.serviceKey.updateMany({ where: { name: LAST_RUN, value: last.value }, data: { value: String(now.getTime()) } });
      if (claimed.count === 0) return;
    } else {
      await prisma.serviceKey.create({ data: { name: LAST_RUN, value: String(now.getTime()) } });
    }
    await runSignOffReminders(now);
  } catch (error) {
    console.error("sign-off reminders failed", error);
  }
}
