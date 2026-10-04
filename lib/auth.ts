import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./constants";
import { prisma } from "./db";

export { SESSION_COOKIE };

const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionTokenPayload } from "./constants";
export type { SessionTokenPayload };

function getSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("AUTH_SECRET must be set to a strong value in production");
    }
    return "dev-insecure-secret-change-me-1234567890";
  }
  return secret;
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

function base64urlEncode(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString("base64url");
}

function base64urlDecode<T>(str: string): T | null {
  try {
    return JSON.parse(Buffer.from(str, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export function createSessionToken(
  payload: Omit<SessionTokenPayload, "expires">,
  ttlMs = SESSION_TTL_MS,
): string {
  const expires = Date.now() + ttlMs;
  const body = base64urlEncode({ ...payload, expires });
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null): SessionTokenPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [userIdOrBody, expiresRaw, signature] = parts;
  // legacy format: userId.expires.signature
  if (signature && expiresRaw && !userIdOrBody.includes(".")) {
    const body = `${userIdOrBody}.${expiresRaw}`;
    const expected = sign(body);
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) {
      const expires = Number(expiresRaw);
      if (Number.isFinite(expires) && expires >= Date.now()) {
        // cannot expand legacy token; force re-login by returning null context
        // but we still know userId? not enough. Better to treat as unverifiable for claims.
        // legacy tokens only carried userId; reject so middleware/actions get fresh claims
        return null;
      }
    }
    return null;
  }
  // new format: body.signature
  const body = `${userIdOrBody}.${expiresRaw}`;
  const expected = sign(body);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const decoded = base64urlDecode<SessionTokenPayload & { expires: number }>(body);
  if (!decoded || !decoded.userId || !Number.isFinite(decoded.expires)) return null;
  if (decoded.expires < Date.now()) return null;
  return decoded;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const getSessionUser = cache(async () => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const claims = verifySessionToken(token);

  if (!claims) {
    // try to load fresh from DB if legacy token? but we can't trust; just null
    return null;
  }

  const user = await prisma.user.findUnique({
    where: { id: claims.userId },
    include: { agency: true, staff: true },
  });
  if (!user) return null;

  // keep claims in sync if agency/user changed? optional; cheap to return fresh
  return user;
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect("/workforce");
  return user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

import bcrypt from "bcryptjs";
