import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import { createRemoteJWKSet, jwtVerify } from "jose";

// "Sign in with Aultrum ID": Pleasant is an OpenID Connect client of
// id.aultrum.co.uk (authorization code flow with PKCE). Pleasant keeps its
// own users, roles and sessions; a user links their Aultrum ID once by
// confirming their Pleasant password, after which either sign-in works.

const issuer = () => (process.env.AULTRUM_ID_URL ?? "").replace(/\/+$/, "");

export function aultrumIdConfigured(): boolean {
  return !!(process.env.AULTRUM_ID_URL && process.env.AULTRUM_ID_CLIENT_ID && process.env.AULTRUM_ID_CLIENT_SECRET);
}

export const AULTRUM_STATE_COOKIE = "pleasant_aid_state";
export const AULTRUM_LINK_COOKIE = "pleasant_aid_link";

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET must be set");
  return s;
}

const mac = (purpose: string, data: string) => createHmac("sha256", secret()).update(`${purpose}.${data}`).digest("base64url");

/** A small signed, expiring JSON value for a cookie. */
export function sealCookie(purpose: string, value: object, ttlMs: number, now = Date.now()): string {
  const data = Buffer.from(JSON.stringify({ ...value, exp: now + ttlMs })).toString("base64url");
  return `${data}.${mac(purpose, data)}`;
}

export function openCookie<T>(purpose: string, cookie: string | undefined, now = Date.now()): T | null {
  if (!cookie) return null;
  const [data, signature] = cookie.split(".");
  if (!data || !signature) return null;
  const a = Buffer.from(signature);
  const b = Buffer.from(mac(purpose, data));
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const value = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as T & { exp: number };
    return value.exp > now ? value : null;
  } catch {
    return null;
  }
}

export interface PendingSignIn {
  state: string;
  verifier: string;
  nonce: string;
  next: string | null;
}

export function newSignIn(redirectUri: string, next: string | null) {
  const pending: PendingSignIn = {
    state: randomBytes(16).toString("base64url"),
    verifier: randomBytes(32).toString("base64url"),
    nonce: randomBytes(16).toString("base64url"),
    next,
  };
  const url = new URL(`${issuer()}/authorize`);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: process.env.AULTRUM_ID_CLIENT_ID ?? "",
    redirect_uri: redirectUri,
    scope: "openid profile email",
    state: pending.state,
    nonce: pending.nonce,
    code_challenge: createHash("sha256").update(pending.verifier).digest("base64url"),
    code_challenge_method: "S256",
  }).toString();
  return { pending, url: url.toString() };
}

export interface AultrumIdentity {
  sub: string;
  email: string;
  name: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function basicAuth() {
  const id = encodeURIComponent(process.env.AULTRUM_ID_CLIENT_ID ?? "");
  const sec = encodeURIComponent(process.env.AULTRUM_ID_CLIENT_SECRET ?? "");
  return `Basic ${Buffer.from(`${id}:${sec}`).toString("base64")}`;
}

/** Exchanges the code and verifies the ID token (signature, issuer, audience, expiry, nonce). */
export async function completeSignIn(code: string, redirectUri: string, pending: PendingSignIn): Promise<AultrumIdentity> {
  const res = await fetch(`${issuer()}/token`, {
    method: "POST",
    headers: { Authorization: basicAuth(), "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: pending.verifier }).toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !json.id_token) throw new Error(`Aultrum ID token exchange failed: ${json.error ?? res.status}`);

  jwks ??= createRemoteJWKSet(new URL(`${issuer()}/jwks`));
  const { payload } = await jwtVerify(json.id_token, jwks, {
    issuer: issuer(),
    audience: process.env.AULTRUM_ID_CLIENT_ID,
    algorithms: ["RS256"],
  });
  if (payload.nonce !== pending.nonce) throw new Error("Aultrum ID nonce mismatch");
  if (!payload.sub || typeof payload.email !== "string") throw new Error("Aultrum ID token is missing claims");
  return { sub: payload.sub, email: payload.email.toLowerCase(), name: String(payload.name ?? "") };
}

async function productApi(method: "PUT" | "POST" | "DELETE", path: string, body: unknown): Promise<boolean> {
  if (!aultrumIdConfigured()) return false;
  try {
    const res = await fetch(`${issuer()}/api/v1${path}`, {
      method,
      headers: { Authorization: basicAuth(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) console.error("aultrum workspace api", path, res.status);
    return res.ok;
  } catch (error) {
    console.error("aultrum workspace api failed", path, error);
    return false;
  }
}

const ROLE_LABELS: Record<string, string> = { ADMIN: "Admin", MANAGER: "Manager", STAFF: "Carer" };

/** Tells Workspace this person belongs to this agency in Pleasant. Never throws. */
export function reportMembership(sub: string, agency: { id: string; name: string }, role: string) {
  return productApi("PUT", "/memberships", { sub, orgId: agency.id, orgName: agency.name, role: ROLE_LABELS[role] ?? role });
}

export function removeMembership(sub: string, agencyId: string) {
  return productApi("DELETE", "/memberships", { sub, orgId: agencyId });
}

export interface ActivitySummary {
  id: string;
  kind: string;
  title: string;
  detail?: string;
  url?: string;
  /** Workspace role labels that may see it ("Admin", "Manager", "Carer"). Omit for everyone. */
  roles?: string[];
  occurredAt: Date;
}

export function reportActivity(agencyId: string, items: ActivitySummary[]) {
  if (items.length === 0) return Promise.resolve(true);
  return productApi("POST", "/activity", { orgId: agencyId, items });
}
