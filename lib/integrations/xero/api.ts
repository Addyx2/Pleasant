import type { Integration } from "@prisma/client";

import { configOf, secretsOf, updateSecrets } from "../store";

import { refreshXeroTokens, xeroApiBase, type XeroTokens } from "./oauth";

export interface XeroSecrets extends XeroTokens {
  connectionId: string;
}

export interface XeroConfig {
  tenantId: string;
  tenantName: string;
  /** Status new invoices get in Xero. AUTHORISED lets payments be recorded against them. */
  invoiceStatus: "AUTHORISED" | "DRAFT";
  /** Sales account code for invoice lines, e.g. "200" (Sales). */
  accountCode: string;
  /** "YYYY-MM-DD": only invoices issued on or after this date are sent. */
  syncFrom: string;
}

export class XeroApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Pulls the readable messages out of a Xero validation error. */
export function xeroErrorMessage(json: unknown, status: number): string {
  const body = json as { Message?: string; Detail?: string; Elements?: { ValidationErrors?: { Message?: string }[] }[] };
  const validation = body?.Elements?.flatMap((e) => e.ValidationErrors ?? []).map((v) => v.Message).filter(Boolean) ?? [];
  if (validation.length) return validation.join("; ");
  if (status === 401) return "Xero rejected Pleasant's access. Reconnect Xero.";
  if (status === 403) return "Pleasant isn't allowed to do that in Xero. Reconnect Xero and approve every permission.";
  if (status === 429) return "Xero's rate limit was reached. The next sync will carry on.";
  return body?.Detail ?? body?.Message ?? `Xero answered ${status}`;
}

/** "/Date(1518685950940+0000)/" or an ISO string → Date. */
export function parseXeroDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const ms = /\/Date\((-?\d+)/.exec(value)?.[1];
  const date = ms ? new Date(Number(ms)) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * A client for one agency's Xero organisation. Refreshes the access token
 * when it's about to expire and saves the rotated refresh token.
 */
export function xeroClient(integration: Integration) {
  let secrets = secretsOf<XeroSecrets>(integration);
  const config = configOf<XeroConfig>(integration);

  async function token(force = false): Promise<string> {
    if (!secrets) throw new XeroApiError("Xero's stored access can't be read. Reconnect Xero.", 401);
    if (force || secrets.expiresAt - Date.now() < 60_000) {
      const fresh = await refreshXeroTokens(secrets.refreshToken);
      secrets = { ...secrets, ...fresh };
      await updateSecrets(integration.id, secrets);
    }
    return secrets.accessToken;
  }

  async function request<T>(method: "GET" | "POST" | "PUT", path: string, body?: unknown, retried = false): Promise<T> {
    const res = await fetch(`${xeroApiBase()}/api.xro/2.0${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${await token()}`,
        "xero-tenant-id": config.tenantId ?? "",
        Accept: "application/json",
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
    if (res.status === 401 && !retried) {
      await token(true);
      return request(method, path, body, true);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new XeroApiError(xeroErrorMessage(json, res.status), res.status);
    return json as T;
  }

  return { config, request, organisation: () => request<{ Organisations: { Name: string }[] }>("GET", "/Organisation") };
}

export type XeroClient = ReturnType<typeof xeroClient>;
