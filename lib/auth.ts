import { createHmac, timingSafeEqual } from "node:crypto";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";

import { SESSION_COOKIE } from "./constants";
import { prisma } from "./db";
import { isOpsRole } from "./permissions";

export { SESSION_COOKIE };
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

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

// Token format: `${userId}.${sessionVersion}.${expires}.${signature}`. The
// version lets us revoke every outstanding session for a user by bumping
// User.sessionVersion (password reset, role change, removal, sign out everywhere).
export function createSessionToken(
  userId: string,
  sessionVersion = 0,
  ttlMs = SESSION_TTL_MS,
): string {
  const expires = Date.now() + ttlMs;
  const payload = `${userId}.${sessionVersion}.${expires}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySessionToken(
  token: string | undefined | null,
): { userId: string; version: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [userId, versionRaw, expiresRaw, signature] = parts;
  const expected = sign(`${userId}.${versionRaw}.${expiresRaw}`);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const expires = Number(expiresRaw);
  if (!Number.isFinite(expires) || expires < Date.now()) return null;
  const version = Number(versionRaw);
  if (!Number.isInteger(version)) return null;
  return { userId, version };
}

export async function setSessionCookie(user: { id: string; sessionVersion: number }) {
  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user.id, user.sessionVersion), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export const getSessionUser = cache(async () => {
  const store = await cookies();
  const session = verifySessionToken(store.get(SESSION_COOKIE)?.value);
  if (!session) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    include: { agency: true, staff: true },
  });
  if (!user || user.deactivatedAt || user.sessionVersion !== session.version) return null;
  return user;
});

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

function homeFor(role: string): string {
  return role === "STAFF" ? "/workforce" : "/qualifiers";
}

// Back-office operations: rota, dispatch, timesheets, staff, clients, compliance.
// Open to admins and managers.
export async function requireOps() {
  const user = await requireUser();
  if (!isOpsRole(user.role)) redirect(homeFor(user.role));
  return user;
}

// Money and account control: payroll, billing, settings, team, audit, imports.
// Admins only.
export async function requireAdmin() {
  const user = await requireUser();
  if (user.role !== "ADMIN") redirect(homeFor(user.role));
  return user;
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;
