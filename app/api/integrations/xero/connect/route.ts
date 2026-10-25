import { randomBytes } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/auth";
import { XERO_STATE_COOKIE, xeroAuthorizeUrl, xeroConfigured } from "@/lib/integrations/xero/oauth";
import { absoluteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

// Starts "Connect Xero": sends the admin to Xero to choose their organisation.
export async function GET() {
  await requireAdmin();
  if (!xeroConfigured()) {
    return NextResponse.redirect(await absoluteUrl("/settings/integrations?xero=not-configured"));
  }
  const state = randomBytes(24).toString("base64url");
  (await cookies()).set(XERO_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/integrations/xero",
    maxAge: 600,
  });
  return NextResponse.redirect(xeroAuthorizeUrl(state, await absoluteUrl("/api/integrations/xero/callback")));
}
