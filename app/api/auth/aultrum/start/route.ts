import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { AULTRUM_STATE_COOKIE, aultrumIdConfigured, newSignIn, sealCookie } from "@/lib/aultrum-id";
import { absoluteUrl } from "@/lib/url";
import { safeNextPath } from "@/lib/utils";

export const dynamic = "force-dynamic";

// "Sign in with Aultrum ID", and where Aultrum Workspace's Open button lands.
export async function GET(request: Request) {
  if (!aultrumIdConfigured()) return NextResponse.redirect(await absoluteUrl("/login"));
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const { pending, url } = newSignIn(await absoluteUrl("/api/auth/aultrum/callback"), next);
  (await cookies()).set(AULTRUM_STATE_COOKIE, sealCookie("aid-state", pending, 10 * 60_000), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/auth/aultrum",
    maxAge: 600,
  });
  return NextResponse.redirect(url);
}
