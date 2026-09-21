"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function requestShiftAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (user.role !== "STAFF" || !staffId) redirect("/workforce");

  const shiftId = String(formData.get("shiftId") ?? "");
  const message = String(formData.get("message") ?? "").trim().slice(0, 300) || null;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId: user.agencyId, status: "OPEN", staffId: null },
    select: { id: true, startAt: true, endAt: true },
  });
  if (!shift) redirect("/workforce/open-shifts?result=gone");

  // Conflict guard: never let the carer request a shift that clashes with
  // an existing live shift (assigned or in progress).
  const clash = await prisma.shift.findFirst({
    where: {
      agencyId: user.agencyId,
      staffId,
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      startAt: { lt: shift.endAt },
      endAt: { gt: shift.startAt },
    },
    select: { id: true },
  });
  if (clash) redirect("/workforce/open-shifts?result=overlap");

  await prisma.shiftRequest.upsert({
    where: { shiftId_staffId: { shiftId, staffId } },
    create: { agencyId: user.agencyId, shiftId, staffId, message },
    update: { status: "PENDING", message },
  });

  revalidatePath("/workforce/open-shifts");
  redirect("/workforce/open-shifts?result=requested");
}