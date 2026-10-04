"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { SESSION_COOKIE, createSessionToken, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validation";

export interface LoginState {
  error?: string;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Check your details and try again" };
  }

  const email = parsed.data.email.toLowerCase();
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return { error: "Incorrect email or password" };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  const store = await cookies();
  const fullUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: { agency: true, staff: true },
  });
  if (!fullUser) return { error: "Account not found" };
  const token = createSessionToken({
    userId: fullUser.id,
    agencyId: fullUser.agencyId,
    role: fullUser.role as "ADMIN" | "STAFF",
    staffId: fullUser.staff?.id ?? null,
    firstName: fullUser.firstName,
    lastName: fullUser.lastName,
    email: fullUser.email,
    agencyName: fullUser.agency?.name ?? "",
    roundingMins: fullUser.agency?.roundingMins ?? null,
    cutoffWeekday: fullUser.agency?.cutoffWeekday != null ? String(fullUser.agency.cutoffWeekday) : null,
    cutoffTime: fullUser.agency?.cutoffTime ?? null,
    payWeekday: fullUser.agency?.payWeekday != null ? String(fullUser.agency.payWeekday) : null,
  });
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  const next = String(formData.get("next") ?? "");
  const fallback = user.role === "STAFF" ? "/workforce" : "/oversight";
  redirect(next.startsWith("/") ? next : fallback);
}

export async function logoutAction(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect("/login");
}
