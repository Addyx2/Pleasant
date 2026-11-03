import { randomUUID } from "node:crypto";

import { productApiJson } from "@/lib/aultrum-id";
import { prisma } from "@/lib/db";

// Pushbots spend from the agency's Allowance in Aultrum Workspace (1 credit =
// 1p): texts sent and received, AI replies, and the Pushbot's number each
// month. Aultrum ID holds the balance and the prices; Pleasant asks before
// each action. When it says no, texting pauses: offers still reach carers'
// apps. If Aultrum ID can't be reached, Pushbots carry on rather than leave
// a shift unfilled, and the miss is logged.

export type PushbotAction = "sms_out" | "sms_in" | "ai_reply" | "number_month";
export type Charge = { ok: true; enforced: boolean } | { ok: false; reason: "empty" | "no_plan"; message: string };

/** Texts over 160 characters go as several parts, each charged. */
export const textParts = (body: string) => (body.length <= 160 ? 1 : Math.ceil(body.length / 153));

async function agencyName(agencyId: string) {
  return (await prisma.agency.findUnique({ where: { id: agencyId }, select: { name: true } }))?.name ?? "Agency";
}

export async function chargeAllowance(agencyId: string, action: PushbotAction, quantity = 1, key: string = randomUUID()): Promise<Charge> {
  const res = await productApiJson<{ ok?: boolean; enforced?: boolean; reason?: "empty" | "no_plan"; message?: string; error?: string }>("POST", "/allowance/spend", {
    orgId: agencyId,
    orgName: await agencyName(agencyId),
    action,
    quantity,
    key: `${agencyId}:${key}`,
  });
  if (res?.status === 402 && res.json.reason) {
    console.log(JSON.stringify({ event: "pushbots_allowance_refused", agencyId, action, reason: res.json.reason }));
    return { ok: false, reason: res.json.reason, message: res.json.message ?? "The Allowance has run out." };
  }
  if (!res || res.status !== 200) {
    console.error(JSON.stringify({ event: "pushbots_allowance_unreachable", agencyId, action, status: res?.status ?? null, error: res?.json.error ?? null }));
    return { ok: true, enforced: false };
  }
  return { ok: true, enforced: !!res.json.enforced };
}

export interface AllowanceView {
  enforced: boolean;
  balance: number;
  plan: string;
  planStatus: string;
  covered: boolean;
  autoTopUp: boolean;
  manageUrl: string;
  prices: { action: string; credits: number; label: string; unit: string }[];
  packs: { key: string; credits: number; pence: number }[];
  plans: { key: string; name: string; pence: number; credits: number; line: string }[];
}

/** The agency's Allowance, for the Pushbot settings page. Null when Aultrum ID can't be reached. */
export async function allowanceView(agencyId: string): Promise<AllowanceView | null> {
  const q = new URLSearchParams({ orgId: agencyId, orgName: await agencyName(agencyId) });
  const res = await productApiJson<AllowanceView>("GET", `/allowance?${q}`);
  return res?.status === 200 ? res.json : null;
}

/** A Stripe Checkout page for a pack or plan, coming back to `returnUrl`. */
export async function allowanceCheckout(agencyId: string, choice: { pack?: string; plan?: string }, returnUrl: string, email?: string): Promise<{ url: string } | { error: string }> {
  const res = await productApiJson<{ url?: string; error?: string }>("POST", "/allowance/checkout", { orgId: agencyId, orgName: await agencyName(agencyId), ...choice, returnUrl, email });
  if (res?.status === 200 && res.json.url) return { url: res.json.url };
  return { error: res?.json.error ?? "Payments couldn't be reached. Try again shortly." };
}
