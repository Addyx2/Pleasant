import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";

/**
 * Generates a secure, passwordless magic link token for a client.
 * Tokens expire in 24 hours by default.
 */
export async function generatePleasantLink(agencyId: string, clientId: string, expiresInHours = 24) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + expiresInHours);

  const linkToken = await prisma.pleasantLinkToken.create({
    data: {
      agencyId,
      clientId,
      token,
      expiresAt,
    },
  });

  return linkToken;
}

/**
 * Validates a pleasant link token.
 * Returns the client if valid and not expired, otherwise throws an error.
 */
export async function validatePleasantLink(token: string) {
  const linkToken = await prisma.pleasantLinkToken.findUnique({
    where: { token },
    include: {
      client: true,
      agency: true,
    },
  });

  if (!linkToken) {
    throw new Error("Invalid or missing access token.");
  }

  if (linkToken.expiresAt < new Date()) {
    throw new Error("This secure link has expired. Please request a new one.");
  }

  // Optionally mark as used if it's a one-time link, but typically 
  // Clientpoint portals remain active for the duration of the expiration window.
  if (!linkToken.usedAt) {
    await prisma.pleasantLinkToken.update({
      where: { id: linkToken.id },
      data: { usedAt: new Date() },
    });
  }

  return linkToken;
}
