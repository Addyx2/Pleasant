// Xero OAuth 2.0 (authorization code flow) for Pleasant's Xero app. The app's
// client ID and secret are Pleasant's, set once per deployment; each agency
// signs in to its own Xero organisation.

const login = () => (process.env.XERO_LOGIN_URL ?? "https://login.xero.com").replace(/\/+$/, "");
const identity = () => (process.env.XERO_IDENTITY_URL ?? "https://identity.xero.com").replace(/\/+$/, "");
export const xeroApiBase = () => (process.env.XERO_API_URL ?? "https://api.xero.com").replace(/\/+$/, "");

// Granular scopes: required for Xero apps created from March 2026.
export const DEFAULT_XERO_SCOPES =
  "openid profile email offline_access accounting.invoices accounting.payments.read accounting.contacts accounting.settings.read";

export function xeroConfigured(): boolean {
  return !!process.env.XERO_CLIENT_ID && !!process.env.XERO_CLIENT_SECRET;
}

export function xeroAuthorizeUrl(state: string, redirectUri: string): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: process.env.XERO_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    scope: process.env.XERO_SCOPES ?? DEFAULT_XERO_SCOPES,
    state,
  });
  return `${login()}/identity/connect/authorize?${params}`;
}

export interface XeroTokens {
  accessToken: string;
  refreshToken: string;
  /** Epoch milliseconds. */
  expiresAt: number;
}

export class XeroAuthError extends Error {}

async function tokenRequest(form: Record<string, string>): Promise<XeroTokens> {
  const basic = Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString("base64");
  const res = await fetch(`${identity()}/connect/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(form).toString(),
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!res.ok || !json.access_token || !json.refresh_token) {
    throw new XeroAuthError(
      json.error === "invalid_grant"
        ? "Xero access has expired or was revoked. Reconnect Xero."
        : `Xero sign-in failed${json.error ? ` (${json.error})` : ""}`,
    );
  }
  return {
    accessToken: json.access_token,
    refreshToken: json.refresh_token,
    expiresAt: Date.now() + (json.expires_in ?? 1800) * 1000,
  };
}

export function exchangeXeroCode(code: string, redirectUri: string) {
  return tokenRequest({ grant_type: "authorization_code", code, redirect_uri: redirectUri });
}

export function refreshXeroTokens(refreshToken: string) {
  return tokenRequest({ grant_type: "refresh_token", refresh_token: refreshToken });
}

export interface XeroConnection {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantType: string;
  createdDateUtc?: string;
}

export async function xeroConnections(accessToken: string): Promise<XeroConnection[]> {
  const res = await fetch(`${xeroApiBase()}/connections`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new XeroAuthError(`Couldn't list Xero organisations (${res.status})`);
  return ((await res.json()) as XeroConnection[]).filter((c) => c.tenantType === "ORGANISATION");
}

/** Removes Pleasant's access to the organisation in Xero. Best effort. */
export async function revokeXeroConnection(accessToken: string, connectionId: string): Promise<void> {
  await fetch(`${xeroApiBase()}/connections/${encodeURIComponent(connectionId)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(10_000),
  }).catch(() => undefined);
}

export const XERO_STATE_COOKIE = "pleasant_xero_state";
