"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { hashPassword, requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { issuePasswordToken, randomPassword } from "@/lib/password";

export interface InviteState {
  ok?: boolean;
  link?: string;
  delivered?: boolean;
  error?: string;
}

export async function createInviteAction(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  const user = await requireAdmin();
  const staffId = String(formData.get("staffId") ?? "");

  const staff = await prisma.staffProfile.findFirst({
    where: { id: staffId, agencyId: user.agencyId },
  });
  if (!staff) return { error: "Carer not found" };
  if (!staff.email) return { error: "This carer has no email address — add one first" };

  // Create (or reconnect) the carer's own login.
  let carerUserId: string;
  if (staff.userId) {
    carerUserId = staff.userId;
  } else {
    const carerUser = await prisma.user.create({
      data: {
        agencyId: user.agencyId,
        email: staff.email,
        passwordHash: await hashPassword(randomPassword()),
        firstName: staff.firstName,
        lastName: staff.lastName,
        role: "STAFF",
      },
    });
    await prisma.staffProfile.update({
      where: { id: staff.id },
      data: { userId: carerUser.id },
    });
    carerUserId = carerUser.id;
  }

  const token = await issuePasswordToken(carerUserId);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const link = `${proto}://${host}/reset/confirm?token=${token}`;

  const { delivered } = await sendEmail({
    to: staff.email,
    subject: "Your Pleasant carer account",
    text: `Hi ${staff.firstName},\n\n${user.agency.name} has invited you to Pleasant. Open this link to set a password and get the carer app:\n\n${link}\n\nThe link is valid for 6 hours.`,
  });

  revalidatePath("/staff");
  return { ok: true, link: delivered ? undefined : link, delivered };
}