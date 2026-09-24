import { createHash, randomBytes } from "node:crypto";

import { prisma } from "@/lib/db";

const TOKEN_TTL_MS = 1000 * 60 * 60 * 6;

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function issuePasswordToken(userId: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({
    where: { id: userId },
    data: {
      resetTokenHash: hashToken(token),
      resetTokenExpAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });
  return token;
}

export async function consumePasswordToken(token: string): Promise<{ userId: string } | null> {
  const user = await prisma.user.findFirst({ where: { resetTokenHash: hashToken(token) } });
  if (!user) return null;
  if (!user.resetTokenExpAt || user.resetTokenExpAt.getTime() < Date.now()) return null;
  await prisma.user.update({
    where: { id: user.id },
    data: { resetTokenHash: null, resetTokenExpAt: null },
  });
  return { userId: user.id };
}

export function randomPassword(): string {
  return randomBytes(18).toString("base64url");
}