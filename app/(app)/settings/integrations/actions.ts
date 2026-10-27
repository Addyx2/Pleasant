"use server";

import { revalidatePath } from "next/cache";

import { recordAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DIVISIONS, isDivision, refreshBankHolidays } from "@/lib/integrations/bank-holidays";
import { integrationDef } from "@/lib/integrations/catalog";
import { toE164 } from "@/lib/integrations/phone";
import { configOf, getIntegration, logIntegration, saveIntegration, secretsOf } from "@/lib/integrations/store";
import {
  looksLikeSid,
  sendSms,
  setIncomingWebhook,
  twilioAccount,
  TwilioError,
  type TwilioConfig,
  type TwilioSecrets,
} from "@/lib/integrations/twilio";
import type { XeroConfig, XeroSecrets } from "@/lib/integrations/xero/api";
import { refreshXeroTokens, revokeXeroConnection } from "@/lib/integrations/xero/oauth";
import { syncXero } from "@/lib/integrations/xero/sync";
import { absoluteUrl } from "@/lib/url";

export interface FormState {
  ok?: boolean;
  message?: string;
  /** What was typed, so a form can refill itself after an error. */
  values?: Record<string, string>;
}

const PAGE = "/settings/integrations";
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();

export async function connectTwilioAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const existing = secretsOf<TwilioSecrets>(await getIntegration(user.agencyId, "twilio"));
  const accountSid = field(form, "accountSid");
  // Leaving the token blank keeps the saved one when only settings change.
  const authToken = field(form, "authToken") || (existing?.accountSid === accountSid ? existing.authToken : "");
  const rawFrom = field(form, "from");
  const from = rawFrom.startsWith("MG") ? rawFrom : toE164(rawFrom);

  const values = { accountSid, from: rawFrom, offers: form.get("offers") === "on" ? "on" : "" };
  if (!looksLikeSid(accountSid)) return { ok: false, message: "The Account SID starts with AC and is 34 characters long.", values };
  if (!authToken) return { ok: false, message: "Enter the Auth Token from your Twilio console.", values };
  if (!from) return { ok: false, message: "Enter the Twilio number to send from (e.g. +447700900123) or a Messaging Service SID (MG...).", values };

  const secrets: TwilioSecrets = { accountSid, authToken };
  let accountName: string;
  try {
    accountName = (await twilioAccount(secrets)).name;
  } catch (error) {
    return { ok: false, message: error instanceof TwilioError ? error.message : "Couldn't reach Twilio. Try again.", values };
  }

  const integration = await saveIntegration({
    agencyId: user.agencyId,
    provider: "twilio",
    config: { from, offers: form.get("offers") === "on", accountName } satisfies TwilioConfig,
    secrets,
    connectedById: user.id,
  });

  // Point the number's incoming texts at Pleasant so carers' replies arrive.
  let webhookSet = false;
  const inbound = await absoluteUrl(`/api/webhooks/twilio/${integration.id}`);
  if (/^https:\/\//.test(inbound)) {
    webhookSet = await setIncomingWebhook(secrets, from, inbound).catch(() => false);
  }
  await prisma.integration.update({
    where: { id: integration.id },
    data: { config: { from, offers: form.get("offers") === "on", accountName, webhookSet } satisfies TwilioConfig },
  });
  await logIntegration(integration, "connect", true, `Connected to ${accountName}, sending from ${from}`);
  await recordAudit(user, { action: "integration.connect", summary: `Connected SMS (Twilio, ${from})`, targetType: "Integration", targetId: integration.id });
  revalidatePath(PAGE);
  return {
    ok: true,
    message: webhookSet
      ? "Connected. Replies to your number now come straight into Pleasant."
      : "Connected. To receive replies, set the number's incoming message webhook to the address shown below.",
  };
}

export async function sendTestSmsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const integration = await getIntegration(user.agencyId, "twilio");
  const secrets = secretsOf<TwilioSecrets>(integration);
  const config = configOf<TwilioConfig>(integration);
  const to = toE164(field(form, "to"));
  if (!integration || !secrets || !config.from) return { ok: false, message: "Connect Twilio first." };
  if (!to) return { ok: false, message: "Enter a mobile number to text, e.g. 07700 900123.", values: { to: field(form, "to") } };
  try {
    await sendSms(secrets, config.from, to, `${user.agency.name}: this is a test text from Pleasant. SMS is working.`);
    await logIntegration(integration, "test", true, `Test text sent to ${to}`);
    return { ok: true, message: `Test text sent to ${to}.` };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Twilio didn't accept the message";
    await logIntegration(integration, "test", false, `Test text failed: ${message}`, {
      health: error instanceof TwilioError && (error.status === 401 || error.status === 403),
    });
    return { ok: false, message, values: { to: field(form, "to") } };
  } finally {
    revalidatePath(PAGE);
  }
}

export async function saveXeroSettingsAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const integration = await getIntegration(user.agencyId, "xero");
  if (!integration) return { ok: false, message: "Connect Xero first." };
  const accountCode = field(form, "accountCode");
  const syncFrom = field(form, "syncFrom");
  const invoiceStatus = field(form, "invoiceStatus") === "DRAFT" ? "DRAFT" : "AUTHORISED";
  if (!/^[A-Za-z0-9.-]{1,10}$/.test(accountCode)) return { ok: false, message: "Enter a Xero account code, e.g. 200." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(syncFrom)) return { ok: false, message: "Choose the date to send invoices from." };
  const config = { ...configOf<XeroConfig>(integration), accountCode, syncFrom, invoiceStatus };
  await prisma.integration.update({ where: { id: integration.id }, data: { config } });
  revalidatePath(PAGE);
  return { ok: true, message: "Saved." };
}

export async function syncXeroAction(_prev: FormState): Promise<FormState> {
  const user = await requireAdmin();
  const integration = await getIntegration(user.agencyId, "xero");
  if (!integration) return { ok: false, message: "Connect Xero first." };
  const result = await syncXero(integration);
  revalidatePath(PAGE);
  revalidatePath("/billing");
  const counts = `${result.sent} invoice${result.sent === 1 ? "" : "s"} sent, ${result.paid} marked paid${result.voided ? `, ${result.voided} voided` : ""}.`;
  if (!result.ok) return { ok: false, message: result.errors[0] ?? "The sync failed." };
  return { ok: result.errors.length === 0, message: result.errors.length ? `${counts} Problems: ${result.errors.slice(0, 2).join("; ")}` : counts };
}

export async function saveBankHolidaysAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireAdmin();
  const division = field(form, "division");
  if (!isDivision(division)) return { ok: false, message: "Choose a nation." };
  await prisma.agency.update({ where: { id: user.agencyId }, data: { bankHolidayDivision: division } });
  await recordAudit(user, { action: "settings.update", summary: `Bank holidays set to ${DIVISIONS[division]}` });
  // Fetch now if the feed has never been loaded, so the choice takes effect.
  const loaded = await prisma.bankHoliday.count();
  const refreshed = loaded === 0 ? await refreshBankHolidays() : null;
  revalidatePath(PAGE);
  if (refreshed && !refreshed.ok) {
    return { ok: false, message: `Saved, but GOV.UK couldn't be reached (${refreshed.error}). The built-in England and Wales dates apply until it can.` };
  }
  return { ok: true, message: `Saved. Pay and charge rates use ${DIVISIONS[division]} bank holidays.` };
}

export async function disconnectAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const provider = String(formData.get("provider") ?? "");
  const integration = await getIntegration(user.agencyId, provider);
  if (!integration) return;
  if (provider === "xero") {
    const secrets = secretsOf<XeroSecrets>(integration);
    if (secrets) {
      // Revoking needs a live access token; refresh one if it has expired.
      const token = secrets.expiresAt > Date.now() + 30_000
        ? secrets.accessToken
        : await refreshXeroTokens(secrets.refreshToken).then((t) => t.accessToken).catch(() => null);
      if (token) await revokeXeroConnection(token, secrets.connectionId);
    }
  }
  await prisma.integration.delete({ where: { id: integration.id } });
  await recordAudit(user, {
    action: "integration.disconnect",
    summary: `Disconnected ${integrationDef(provider)?.name ?? provider}`,
    targetType: "Integration",
    targetId: integration.id,
  });
  revalidatePath(PAGE);
}
