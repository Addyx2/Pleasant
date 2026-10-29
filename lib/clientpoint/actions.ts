"use server";

import { prisma } from "@/lib/db";
import { agencyBankHolidays } from "@/lib/integrations/bank-holidays";
import { revalidatePath } from "next/cache";
import { resolveChargeRate, toRateCardEntry } from "@/lib/clients";
import { validatePleasantLink } from "./pleasant-link";
import { after } from "next/server";
import { reportShiftCompleted } from "@/lib/elements-sync";

/**
 * Server Action for a client signatory to sign off a timesheet via their Aultrum Link.
 * The signer is the contact the link was issued to — never a name sent by the browser.
 */
export async function signOffTimesheet(token: string, timesheetId: string) {
  try {
    const linkSession = await validatePleasantLink(token);
    const signer = linkSession.contact;
    if (!signer || !signer.isSignatory) {
      throw new Error("This link isn't issued to an authorised signatory. Ask your agency for a new link.");
    }

    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: { shift: true },
    });

    if (!timesheet || timesheet.agencyId !== linkSession.agencyId) throw new Error("Timesheet not found");
    if (timesheet.shift.clientId !== linkSession.clientId) {
      throw new Error("Unauthorized: Timesheet does not belong to this client account.");
    }
    if (timesheet.status !== "PENDING") throw new Error("This timesheet has already been decided.");

    const position = signer.jobTitle ?? "Authorised signatory";
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: "APPROVED",
        clientAuthName: signer.name,
        clientAuthPosition: position,
        clientAuthAt: new Date(),
        clientAuthSignature: `PLEASANT_LINK:${linkSession.id}`,
      },
    });

    after(() => reportShiftCompleted(linkSession.agencyId, timesheetId));
    await prisma.agentLog.create({
      data: {
        agencyId: linkSession.agencyId,
        agentName: "CLIENTPOINT",
        action: "TIMESHEET_SIGNOFF",
        details: `${signer.name} (${position}) signed off Timesheet ${timesheetId}.`,
        status: "SUCCESS",
      }
    });

    revalidatePath(`/pleasant-link/${token}`);
    return { success: true };
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

/**
 * Server Action for a Client to submit a new Shift Request.
 */
export async function requestShifts(token: string, role: string, startAt: Date, endAt: Date, notes?: string) {
  try {
    const linkSession = await validatePleasantLink(token);
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(end > start)) throw new Error("The shift must end after it starts.");

    // Price the request from the client's rate card so it isn't invoiced at £0.
    const rates = await prisma.clientRate.findMany({ where: { clientId: linkSession.clientId } });
    const resolved = resolveChargeRate(
      rates.map(toRateCardEntry),
      { role, startAt: start, endAt: end },
      await agencyBankHolidays(linkSession.agencyId),
    );

    // Creates an OPEN shift ready for triage
    const shift = await prisma.shift.create({
      data: {
        agencyId: linkSession.agencyId,
        clientId: linkSession.clientId,
        title: `Client Request: ${role}`,
        role: role,
        startAt: start,
        endAt: end,
        chargeRate: resolved?.rate ?? 0,
        status: "OPEN",
        notes: linkSession.contact ? [notes, `Requested by ${linkSession.contact.name}`].filter(Boolean).join(" · ") : notes,
      }
    });

    // Log the request
    await prisma.agentLog.create({
      data: {
        agencyId: linkSession.agencyId,
        agentName: "CLIENTPOINT",
        action: "SHIFT_REQUEST_SUBMITTED",
        details: `Client requested ${role} shift (ID: ${shift.id}).`,
        status: "SUCCESS",
      }
    });

    revalidatePath(`/pleasant-link/${token}`);
    return { success: true, shiftId: shift.id };
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}
