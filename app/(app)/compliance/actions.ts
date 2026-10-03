"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeAccount, normalizeSortCode } from "@/lib/payroll/bacs";

function parseDate(value: FormDataEntryValue | null): Date | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function revalidateStaff(staffId: string) {
  revalidatePath("/compliance");
  revalidatePath("/staff");
  revalidatePath(`/staff/${staffId}`);
}

export async function saveBankDetailsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return;

  const owned = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
    select: { id: true },
  });
  if (!owned) return;

  await prisma.staffProfile.updateMany({
    where: { id: staffId, agencyId: user.agencyId },
    data: {
      bankName: String(formData.get("bankName") ?? "").trim() || null,
      accountName: String(formData.get("accountName") ?? "").trim() || null,
      sortCode: normalizeSortCode(String(formData.get("sortCode") ?? "")) || null,
      bankAcct: normalizeAccount(String(formData.get("bankAcct") ?? "")) || null,
    },
  });

  revalidateStaff(staffId);
}

export async function saveDbsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  if (!staffId) return;

  const owned = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
    select: { id: true },
  });
  if (!owned) return;

  await prisma.staffProfile.updateMany({
    where: { id: staffId, agencyId: user.agencyId },
    data: {
      dbsNumber: String(formData.get("dbsNumber") ?? "").trim() || null,
      dbsExpiry: parseDate(formData.get("dbsExpiry")),
    },
  });

  revalidateStaff(staffId);
}

export async function saveRightToWorkAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  const documentType = String(formData.get("documentType") ?? "").trim().toUpperCase();
  if (!staffId) return;

  const owned = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
    select: { id: true },
  });
  if (!owned) return;

  const expiryDate = parseDate(formData.get("expiryDate"));
  const issueDate = parseDate(formData.get("issueDate"));

  await prisma.rightToWork.upsert({
    where: { staffId },
    create: {
      agencyId: user.agencyId,
      staffId,
      documentType: documentType || "SHARE_CODE",
      documentNumber: String(formData.get("documentNumber") ?? "").trim() || null,
      issueDate,
      expiryDate,
      verifiedAt: new Date(),
      verifiedById: user.id,
      status: "VERIFIED",
    },
    update: {
      documentType: documentType || "SHARE_CODE",
      documentNumber: String(formData.get("documentNumber") ?? "").trim() || null,
      issueDate,
      expiryDate,
      verifiedAt: new Date(),
      verifiedById: user.id,
      status: "VERIFIED",
    },
  });

  revalidateStaff(staffId);
}

export async function addTrainingAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");
  const courseName = String(formData.get("courseName") ?? "").trim();
  if (!staffId || !courseName) return;

  const owned = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
    select: { id: true },
  });
  if (!owned) return;

  await prisma.trainingRecord.create({
    data: {
      agencyId: user.agencyId,
      staffId,
      courseName: courseName.slice(0, 120),
      provider: String(formData.get("provider") ?? "").trim() || null,
      completedAt: parseDate(formData.get("completedAt")),
      expiryDate: parseDate(formData.get("expiryDate")),
      status: "COMPLETED",
    },
  });

  revalidateStaff(staffId);
}
