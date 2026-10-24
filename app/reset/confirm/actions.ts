"use server";

import { hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { consumePasswordToken } from "@/lib/password";
import { recordAudit } from "@/lib/audit";

export interface ResetConfirmState {
  ok?: boolean;
  error?: string;
}

export async function confirmResetAction(
  _prev: ResetConfirmState,
  formData: FormData,
): Promise<ResetConfirmState> {
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters" };

  const result = await consumePasswordToken(token);
  if (!result) return { error: "This link has expired or already been used" };

  // A new password revokes every existing session and clears any lockout.
  const user = await prisma.user.update({
    where: { id: result.userId },
    data: {
      passwordHash: await hashPassword(password),
      sessionVersion: { increment: 1 },
      failedLoginCount: 0,
      lockedUntil: null,
    },
  });
  await recordAudit(user, {
    action: "auth.password_set",
    summary: "Set a new password",
    targetType: "User",
    targetId: user.id,
  });

  return { ok: true };
}