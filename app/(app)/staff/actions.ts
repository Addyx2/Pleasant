"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { createAultrumLink, removeMembership } from "@/lib/aultrum-id";
import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createStaffSchema } from "@/lib/validation";
import type { ActionState } from "@/app/(app)/shifts/actions";
import { after } from "next/server";
import { sendElementEvent } from "@/lib/elements";
import { carerPerson } from "@/lib/elements-sync";

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireOps();

  const parsed = createStaffSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    jobTitle: formData.get("jobTitle"),
    band: formData.get("band"),
    niNumber: formData.get("niNumber"),
    engagementType: formData.get("engagementType") || "PAYE",
    ltdCompanyName: formData.get("ltdCompanyName"),
    taxCode: formData.get("taxCode") || "1257L",
    studentLoanPlan: formData.get("studentLoanPlan") || "NONE",
    baseRate: formData.get("baseRate") || 0,
    nightRate: formData.get("nightRate") || undefined,
    weekendRate: formData.get("weekendRate") || undefined,
    bankHolidayRate: formData.get("bankHolidayRate") || undefined,
    holidayAccrualPct: formData.get("holidayAccrualPct") || 12.07,
    pensionEnrolled: formData.get("pensionEnrolled") === "on",
    pensionEmployeePct: formData.get("pensionEmployeePct") || 5,
    pensionEmployerPct: formData.get("pensionEmployerPct") || 3,
    bankName: formData.get("bankName"),
    accountName: formData.get("accountName"),
    sortCode: formData.get("sortCode"),
    bankAcct: formData.get("bankAcct"),
    dbsNumber: formData.get("dbsNumber"),
    dbsExpiry: formData.get("dbsExpiry"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save this carer" };
  }

  const data = parsed.data;

  const created = await prisma.staffProfile.create({
    data: {
      agencyId: user.agencyId,
      firstName: data.firstName,
      lastName: data.lastName,
      email: data.email ?? null,
      phone: data.phone ?? null,
      jobTitle: data.jobTitle,
      band: data.band ?? null,
      niNumber: data.niNumber ?? null,
      engagementType: data.engagementType,
      ltdCompanyName: data.ltdCompanyName ?? null,
      taxCode: data.taxCode,
      studentLoanPlan: data.studentLoanPlan,
      baseRate: data.baseRate,
      nightRate: data.nightRate ?? null,
      weekendRate: data.weekendRate ?? null,
      bankHolidayRate: data.bankHolidayRate ?? null,
      holidayAccrualPct: data.holidayAccrualPct,
      pensionEnrolled: data.pensionEnrolled,
      pensionEmployeePct: data.pensionEmployeePct,
      pensionEmployerPct: data.pensionEmployerPct,
      bankName: data.bankName ?? null,
      accountName: data.accountName ?? null,
      sortCode: data.sortCode ?? null,
      bankAcct: data.bankAcct ?? null,
      dbsNumber: data.dbsNumber ?? null,
      dbsExpiry: data.dbsExpiry ?? null,
      status: "ACTIVE",
    },
  });
  if (created.phone) after(() => sendElementEvent(user.agencyId, "GATEWAY", "platform.person.updated", carerPerson(created)));

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { success: "Carer added" };
}

export async function setStaffStatusAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const staffId = String(formData.get("staffId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!staffId || !["ACTIVE", "INACTIVE", "ON_LEAVE"].includes(status)) return;

  await prisma.staffProfile.updateMany({
    where: { id: staffId, agencyId: user.agencyId },
    data: { status: status as never },
  });

  revalidatePath("/staff");
}

export interface AultrumLinkState {
  error?: string;
  link?: { code: string; url: string; expiresAt: string };
}

/** An Aultrum Link for this carer to join the agency in the Aultrum app. */
export async function createAultrumLinkAction(staffId: string): Promise<AultrumLinkState> {
  const user = await requireOps();
  const staff = await prisma.staffProfile.findFirst({ where: { id: staffId, agencyId: user.agencyId }, select: { id: true, firstName: true, lastName: true, status: true } });
  if (!staff) return { error: "Carer not found." };
  if (staff.status === "INACTIVE") return { error: "Make this carer active before inviting them." };
  try {
    const link = await createAultrumLink(user.agency, staff);
    await recordAudit(user, {
      action: "staff.aultrum_link",
      summary: `Created an Aultrum Link for ${staff.firstName} ${staff.lastName}`,
      targetType: "StaffProfile",
      targetId: staff.id,
    });
    return { link };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Couldn't make the link." };
  }
}

/** Disconnects the carer's Aultrum app: the agency disappears from it. */
export async function disconnectAultrumAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const staff = await prisma.staffProfile.findFirst({ where: { id: String(formData.get("staffId") ?? ""), agencyId: user.agencyId } });
  if (!staff?.aultrumSub) return;
  await prisma.staffProfile.update({ where: { id: staff.id }, data: { aultrumSub: null } });
  await removeMembership(staff.aultrumSub, user.agencyId);
  await recordAudit(user, {
    action: "staff.aultrum_disconnect",
    summary: `Disconnected ${staff.firstName} ${staff.lastName}'s Aultrum app`,
    targetType: "StaffProfile",
    targetId: staff.id,
  });
  revalidatePath(`/staff/${staff.id}`);
}
