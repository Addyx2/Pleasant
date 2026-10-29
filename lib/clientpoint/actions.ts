"use server";

import { revalidatePath } from "next/cache";

import { requestStaff, signOffAsClient } from "@/lib/supply";

import { validatePleasantLink } from "./pleasant-link";

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
    const result = await signOffAsClient(linkSession.agencyId, linkSession.clientId, timesheetId, {
      name: signer.name,
      position: signer.jobTitle ?? "Authorised signatory",
      evidence: `PLEASANT_LINK:${linkSession.id}`,
    });
    if (!result.ok) throw new Error(result.error);
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
    const result = await requestStaff(linkSession.agencyId, linkSession.clientId, {
      role,
      startAt: new Date(startAt),
      endAt: new Date(endAt),
      notes,
      requestedBy: linkSession.contact?.name ?? null,
    });
    if (!result.ok) throw new Error(result.error);
    revalidatePath(`/pleasant-link/${token}`);
    return { success: true, shiftId: result.shiftIds?.[0] };
  } catch (error: unknown) {
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}
