"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";

function refresh() {
  revalidatePath("/shifts/requests");
  revalidatePath("/shifts");
  revalidatePath("/workforce/open-shifts");
  revalidatePath("/workforce");
  revalidatePath("/dashboard");
}

export async function approveShiftRequestAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");

  const req = await prisma.shiftRequest.findFirst({
    where: { id: requestId, status: "PENDING", agencyId: user.agencyId },
  });
  if (!req) redirect("/shifts/requests");

  // If the shift was assigned elsewhere in the meantime, decline the request.
  const shiftAlreadyTaken = await prisma.shift.count({
    where: { id: req.shiftId, agencyId: req.agencyId, NOT: { staffId: null } },
  });
  if (shiftAlreadyTaken > 0) {
    await prisma.shiftRequest.update({
      where: { id: req.id, agencyId: user.agencyId },
      data: { status: "REJECTED" },
    });
    refresh();
    redirect("/shifts/requests?result=taken");
  }

  await prisma.$transaction([
    prisma.shift.update({
      where: { id: req.shiftId },
      data: { staffId: req.staffId, status: "ASSIGNED" },
    }),
    prisma.shiftRequest.update({ where: { id: req.id }, data: { status: "APPROVED" } }),
    prisma.shiftRequest.updateMany({
      where: { shiftId: req.shiftId, status: "PENDING", NOT: { id: req.id } },
      data: { status: "REJECTED" },
    }),
  ]);

  refresh();
  redirect("/shifts/requests?result=approved");
}

export async function rejectShiftRequestAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const requestId = String(formData.get("requestId") ?? "");

  await prisma.shiftRequest.updateMany({
    where: { id: requestId, status: "PENDING", agencyId: user.agencyId },
    data: { status: "REJECTED" },
  });

  refresh();
  redirect("/shifts/requests?result=rejected");
}