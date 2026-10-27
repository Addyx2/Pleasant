import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import {
  AULTRUM_LINK_COOKIE,
  AULTRUM_STATE_COOKIE,
  completeSignIn,
  openCookie,
  sealCookie,
  type PendingSignIn,
} from "@/lib/aultrum-id";
import { signInWithAultrum } from "@/lib/aultrum-signin";
import { prisma } from "@/lib/db";
import { absoluteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

const toLogin = async (error: string) => NextResponse.redirect(await absoluteUrl(`/login?aultrum=${error}`));

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const pending = openCookie<PendingSignIn>("aid-state", jar.get(AULTRUM_STATE_COOKIE)?.value);
  jar.delete({ name: AULTRUM_STATE_COOKIE, path: "/api/auth/aultrum" });

  if (!pending || params.get("state") !== pending.state) return toLogin("expired");
  if (params.get("error")) return toLogin("cancelled");

  let identity;
  try {
    identity = await completeSignIn(params.get("code") ?? "", await absoluteUrl("/api/auth/aultrum/callback"), pending);
  } catch (error) {
    console.error("aultrum id sign-in failed", error);
    return toLogin("failed");
  }

  // Already linked: sign straight in.
  const linked = await prisma.user.findFirst({ where: { aultrumSub: identity.sub } });
  if (linked) {
    if (linked.deactivatedAt) return toLogin("no-access");
    const home = await signInWithAultrum(linked, identity.sub, "aultrum");
    return NextResponse.redirect(await absoluteUrl(pending.next ?? home));
  }

  // Not linked yet: the person proves they own the Pleasant account with its
  // password once. The Aultrum ID email alone isn't enough to take it over.
  const user = await prisma.user.findUnique({ where: { email: identity.email } });
  if (!user || user.deactivatedAt) return toLogin("no-account");
  jar.set(AULTRUM_LINK_COOKIE, sealCookie("aid-link", { ...identity, next: pending.next }, 10 * 60_000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/login",
    maxAge: 600,
  });
  return NextResponse.redirect(await absoluteUrl("/login/link"));
}
