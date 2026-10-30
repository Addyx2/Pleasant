"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Mark something Gateway or Peak raised as dealt with. */
export async function resolveElementsEventAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const id = String(formData.get("id") ?? "");
  const name = `${user.firstName} ${user.lastName}`;
  const updated = await prisma.elementsEvent.updateMany({
    where: { id, agencyId: user.agencyId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedBy: name },
  });
  if (updated.count > 0) await recordAudit(user, { action: "elements.resolve", summary: `Marked an Elements item as done` });
  revalidatePath("/qualifiers");
}
