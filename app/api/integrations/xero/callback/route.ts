import { timingSafeEqual } from "node:crypto";

import { cookies } from "next/headers";
import { NextResponse } from "next/server";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { logIntegration, saveIntegration } from "@/lib/integrations/store";
import type { XeroConfig, XeroSecrets } from "@/lib/integrations/xero/api";
import { exchangeXeroCode, XERO_STATE_COOKIE, xeroConnections } from "@/lib/integrations/xero/oauth";
import { absoluteUrl } from "@/lib/url";

export const dynamic = "force-dynamic";

const back = async (result: string) => NextResponse.redirect(await absoluteUrl(`/settings/integrations?xero=${result}`));

// Xero sends the admin back here after they approve (or cancel) access.
export async function GET(request: Request) {
  const user = await requireAdmin();
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const expected = jar.get(XERO_STATE_COOKIE)?.value ?? "";
  jar.delete({ name: XERO_STATE_COOKIE, path: "/api/integrations/xero" });

  const state = params.get("state") ?? "";
  if (!expected || state.length !== expected.length || !timingSafeEqual(Buffer.from(state), Buffer.from(expected))) {
    return back("expired");
  }
  if (params.get("error")) return back("cancelled");
  const code = params.get("code");
  if (!code) return back("failed");

  try {
    const tokens = await exchangeXeroCode(code, await absoluteUrl("/api/integrations/xero/callback"));
    // If several organisations were approved, use the one connected most recently.
    const orgs = (await xeroConnections(tokens.accessToken)).sort((a, b) =>
      (b.createdDateUtc ?? "").localeCompare(a.createdDateUtc ?? ""),
    );
    const org = orgs[0];
    if (!org) return back("no-organisation");

    const config: XeroConfig = {
      tenantId: org.tenantId,
      tenantName: org.tenantName,
      invoiceStatus: "AUTHORISED",
      accountCode: "200",
      syncFrom: new Date().toISOString().slice(0, 10),
    };
    const secrets: XeroSecrets = { ...tokens, connectionId: org.id };
    const integration = await saveIntegration({ agencyId: user.agencyId, provider: "xero", config: { ...config }, secrets, connectedById: user.id });
    await logIntegration(integration, "connect", true, `Connected to ${org.tenantName}`);
    await recordAudit(user, {
      action: "integration.connect",
      summary: `Connected Xero (${org.tenantName})`,
      targetType: "Integration",
      targetId: integration.id,
    });
    return back("connected");
  } catch (error) {
    console.error("xero connect failed", error);
    return back("failed");
  }
}
