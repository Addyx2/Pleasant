"use server";

import { prisma } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { validatePleasantLink } from "./pleasant-link";

/**
 * Server Action for a Client to digitally sign off on a timesheet via their Pleasant Link portal.
 */
export async function signOffTimesheet(token: string, timesheetId: string, clientName: string, position: string) {
  try {
    // 1. Validate the secure token
    const linkSession = await validatePleasantLink(token);

    // 2. Fetch the timesheet
    const timesheet = await prisma.timesheet.findUnique({
      where: { id: timesheetId },
      include: { shift: true },
    });

    if (!timesheet) throw new Error("Timesheet not found");
    
    // Ensure the timesheet belongs to the client accessed via the token
    if (timesheet.shift.clientId !== linkSession.clientId) {
      throw new Error("Unauthorized: Timesheet does not belong to this client account.");
    }

    // 3. Update the timesheet with the digital sign-off
    await prisma.timesheet.update({
      where: { id: timesheetId },
      data: {
        status: "APPROVED",
        clientAuthName: clientName,
        clientAuthPosition: position,
        clientAuthAt: new Date(),
        clientAuthSignature: "DIGITAL_SIGNATURE_CAPTURED", // In production, this would be a hash or Base64 SVG
      },
    });

    // 4. Log the action
    await prisma.agentLog.create({
      data: {
        agencyId: linkSession.agencyId,
        agentName: "CLIENTPOINT",
        action: "TIMESHEET_SIGNOFF",
        details: `Client ${clientName} (${position}) signed off Timesheet ${timesheetId}.`,
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

    // Creates an OPEN shift ready for triage
    const shift = await prisma.shift.create({
      data: {
        agencyId: linkSession.agencyId,
        clientId: linkSession.clientId,
        title: `Client Request: ${role}`,
        role: role,
        startAt: startAt,
        endAt: endAt,
        status: "OPEN",
        notes: notes,
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
