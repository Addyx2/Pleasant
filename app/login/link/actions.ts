"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AULTRUM_LINK_COOKIE, openCookie, type AultrumIdentity } from "@/lib/aultrum-id";
import { signInWithAultrum } from "@/lib/aultrum-signin";
import { verifyPassword } from "@/lib/auth";
import { LOCKOUT_MINUTES, MAX_FAILED_LOGINS } from "@/lib/constants";
import { prisma } from "@/lib/db";

export interface LinkState {
  error?: string;
}

export type PendingLink = AultrumIdentity & { next: string | null };

export async function linkAultrumAction(_prev: LinkState, form: FormData): Promise<LinkState> {
  const jar = await cookies();
  const pending = openCookie<PendingLink>("aid-link", jar.get(AULTRUM_LINK_COOKIE)?.value);
  if (!pending) redirect("/login?aultrum=expired");

  const user = await prisma.user.findUnique({ where: { email: pending.email } });
  if (!user || user.deactivatedAt) redirect("/login?aultrum=no-account");
  if (user.aultrumSub && user.aultrumSub !== pending.sub) {
    return { error: "This Pleasant account is already linked to a different Aultrum ID." };
  }
  if (await prisma.user.findFirst({ where: { aultrumSub: pending.sub, id: { not: user.id } }, select: { id: true } })) {
    return { error: "This Aultrum ID is already linked to another Pleasant account." };
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    return { error: "Too many failed attempts. Try again later, or reset your password." };
  }
  if (!(await verifyPassword(String(form.get("password") ?? ""), user.passwordHash))) {
    // Counts towards the same lockout as the normal sign-in form.
    const failed = user.failedLoginCount + 1;
    const lock = failed >= MAX_FAILED_LOGINS;
    await prisma.user.update({
      where: { id: user.id },
      data: { failedLoginCount: lock ? 0 : failed, lockedUntil: lock ? new Date(Date.now() + LOCKOUT_MINUTES * 60_000) : null },
    });
    return { error: "That isn't your Pleasant password." };
  }

  jar.delete({ name: AULTRUM_LINK_COOKIE, path: "/login" });
  const home = await signInWithAultrum(user, pending.sub, "aultrum_link");
  redirect(pending.next ?? home);
}
