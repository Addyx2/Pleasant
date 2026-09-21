"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { createStaffSchema } from "@/lib/validation";
import type { ActionState } from "@/app/(app)/shifts/actions";

export async function createStaffAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

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
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save this carer" };
  }

  const data = parsed.data;

  await prisma.staffProfile.create({
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
      status: "ACTIVE",
    },
  });

  revalidatePath("/staff");
  revalidatePath("/dashboard");
  return { success: "Carer added" };
}

export async function setStaffStatusAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!staffId || !["ACTIVE", "INACTIVE", "ON_LEAVE"].includes(status)) return;

  await prisma.staffProfile.updateMany({
    where: { id: staffId, agencyId: user.agencyId },
    data: { status: status as never },
  });

  revalidatePath("/staff");
}
