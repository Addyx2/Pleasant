"use server";

import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/db";
import { issuePasswordToken } from "@/lib/password";
import { sendEmail } from "@/lib/email";

export interface ResetRequestState {
  ok?: boolean;
  link?: string;
}

export async function requestResetAction(
  _prev: ResetRequestState,
  formData: FormData,
): Promise<ResetRequestState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!z.string().email().safeParse(email).success) return { ok: true };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return { ok: true };

  const token = await issuePasswordToken(user.id);

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (process.env.NODE_ENV === "production" ? "https" : "http");
  const link = `${proto}://${host}/reset/confirm?token=${token}`;

  const { delivered } = await sendEmail({
    to: user.email,
    subject: "Choose a new Pleasant password",
    text: `Open this link to choose a new password (valid for 6 hours):\n\n${link}`,
  });

  return { ok: true, link: delivered ? undefined : link };
}