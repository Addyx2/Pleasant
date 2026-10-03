"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { normalizeAccount, normalizeSortCode } from "@/lib/payroll/bacs";

function text(formData: FormData, key: string): string | null {
  const value = String(formData.get(key) ?? "").trim();
  return value.length > 0 ? value : null;
}

export async function saveAgencyInvoiceDetailsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      companyNo: text(formData, "companyNo"),
      vatNumber: text(formData, "vatNumber"),
      invoiceEmail: text(formData, "invoiceEmail"),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/billing");
}

export async function saveAgencyBankDetailsAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();

  await prisma.agency.update({
    where: { id: user.agencyId },
    data: {
      bankSortCode: normalizeSortCode(String(formData.get("bankSortCode") ?? "")) || null,
      bankAccount: normalizeAccount(String(formData.get("bankAccount") ?? "")) || null,
      bankAccountName: text(formData, "bankAccountName"),
    },
  });

  revalidatePath("/settings");
  revalidatePath("/payroll");
}