import { createHash, createHmac, createPrivateKey, createPublicKey, generateKeyPairSync, randomBytes, timingSafeEqual } from "node:crypto";

import { createRemoteJWKSet, exportJWK, importPKCS8, jwtVerify, SignJWT, type JWK } from "jose";

import { serviceKey } from "@/lib/service-keys";

// "Sign in with Aultrum ID": Pleasant is an OpenID Connect client of
// id.aultrum.co.uk (authorization code flow with PKCE). Pleasant keeps its
// own users, roles and sessions; a user links their Aultrum ID once by
// confirming their Pleasant password, after which either sign-in works.
//
// Nothing to set up: when deployed, Pleasant talks to https://id.aultrum.co.uk
// as client aid_pleasant, and proves it is Pleasant by signing its requests
// with a key it makes for itself and publishes at /.well-known/jwks.json
// (private_key_jwt). AULTRUM_ID_URL, AULTRUM_ID_CLIENT_ID and
// AULTRUM_ID_CLIENT_SECRET override that, e.g. for local development.

const live = process.env.NODE_ENV === "production" && process.env.AULTRUM_LOCAL !== "1";
const issuer = () => (process.env.AULTRUM_ID_URL ?? (live ? "https://id.aultrum.co.uk" : "")).replace(/\/+$/, "");
const clientId = () => process.env.AULTRUM_ID_CLIENT_ID ?? "aid_pleasant";

export function aultrumIdConfigured(): boolean {
  return !!issuer();
}

let reachable: { ok: boolean; at: number } | null = null;

/** Whether to offer the button: Aultrum ID is set up and answering (checked at most once a minute). */
export async function aultrumIdAvailable(): Promise<boolean> {
  if (!aultrumIdConfigured()) return false;
  if (reachable && Date.now() - reachable.at < 60_000) return reachable.ok;
  const ok = await fetch(`${issuer()}/.well-known/openid-configuration`, { signal: AbortSignal.timeout(2_000) })
    .then((r) => r.ok)
    .catch(() => false);
  reachable = { ok, at: Date.now() };
  return ok;
}

// Pleasant's own signing key, made once and kept in the database.
async function clientKey() {
  const pem = await serviceKey("aultrum-client-key", () =>
    generateKeyPairSync("rsa", { modulusLength: 2048 }).privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  );
  const publicJwk = await exportJWK(createPublicKey(createPrivateKey(pem)));
  const kid = createHash("sha256").update(`${publicJwk.n}.${publicJwk.e}`).digest("base64url").slice(0, 16);
  return { kid, privateKey: await importPKCS8(pem, "RS256"), publicJwk: { ...publicJwk, kid, alg: "RS256", use: "sig" } as JWK };
}

/** The public half of Pleasant's key, served at /.well-known/jwks.json for Aultrum ID to check signatures with. */
export async function publicJwks(): Promise<{ keys: JWK[] }> {
  return { keys: [(await clientKey()).publicJwk] };
}

/** A short-lived JWT proving the request comes from Pleasant (private_key_jwt). */
async function clientAssertion(audience: string): Promise<string> {
  return signedAssertion(clientId(), audience);
}

/**
 * A two-minute JWT signed with Pleasant's own key, for services that check it
 * against /.well-known/jwks.json: Aultrum ID, and the Elements console.
 */
export async function signedAssertion(issuer: string, audience: string): Promise<string> {
  const key = await clientKey();
  return new SignJWT({})
    .setProtectedHeader({ alg: "RS256", kid: key.kid, typ: "JWT" })
    .setIssuer(issuer)
    .setSubject(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("2m")
    .setJti(randomBytes(16).toString("base64url"))
    .sign(key.privateKey);
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
    client_id: clientId(),
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

/** With a client secret configured, HTTP Basic; otherwise none (Pleasant signs an assertion instead). */
function basicAuth(): string | null {
  const sec = process.env.AULTRUM_ID_CLIENT_SECRET;
  if (!sec) return null;
  return `Basic ${Buffer.from(`${encodeURIComponent(clientId())}:${encodeURIComponent(sec)}`).toString("base64")}`;
}

/** Exchanges the code and verifies the ID token (signature, issuer, audience, expiry, nonce). */
export async function completeSignIn(code: string, redirectUri: string, pending: PendingSignIn): Promise<AultrumIdentity> {
  const basic = basicAuth();
  const form = new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: pending.verifier });
  if (!basic) {
    form.set("client_assertion_type", "urn:ietf:params:oauth:client-assertion-type:jwt-bearer");
    form.set("client_assertion", await clientAssertion(`${issuer()}/token`));
  }
  const res = await fetch(`${issuer()}/token`, {
    method: "POST",
    headers: { ...(basic ? { Authorization: basic } : {}), "Content-Type": "application/x-www-form-urlencoded" },
    body: form.toString(),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await res.json().catch(() => ({}))) as { id_token?: string; error?: string };
  if (!res.ok || !json.id_token) throw new Error(`Aultrum ID token exchange failed: ${json.error ?? res.status}`);

  jwks ??= createRemoteJWKSet(new URL(`${issuer()}/jwks`));
  const { payload } = await jwtVerify(json.id_token, jwks, {
    issuer: issuer(),
    audience: clientId(),
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
      headers: { Authorization: basicAuth() ?? `Bearer ${await clientAssertion(`${issuer()}/api/v1`)}`, "Content-Type": "application/json" },
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

/**
 * Checks a Carer API request from the Aultrum carer app: a one-minute JWT
 * Aultrum ID signed for one person (sub) and one of their organisations
 * (org) here. Returns them, or null.
 */
export async function verifyCarerToken(token: string): Promise<{ sub: string; org: string; ref: string | null } | null> {
  if (!aultrumIdConfigured()) return null;
  try {
    jwks ??= createRemoteJWKSet(new URL(`${issuer()}/jwks`));
    const { payload } = await jwtVerify(token, jwks, {
      issuer: issuer(),
      audience: clientId(),
      algorithms: ["RS256"],
      typ: "carer+jwt",
      maxTokenAge: "2m",
    });
    if (!payload.sub || typeof payload.org !== "string") return null;
    return { sub: payload.sub, org: payload.org, ref: typeof payload.ref === "string" ? payload.ref : null };
  } catch {
    return null;
  }
}

export interface AultrumLink {
  code: string;
  url: string;
  expiresAt: string;
}

/**
 * An Aultrum Link for one carer: they open it (or type its code) in the
 * Aultrum app to join this agency there. Throws with a message to show.
 */
export async function createAultrumLink(agency: { id: string; name: string }, staff: { id: string; firstName: string; lastName: string }): Promise<AultrumLink> {
  if (!aultrumIdConfigured()) throw new Error("Aultrum ID isn't set up for this Pleasant, so Aultrum Links can't be made.");
  let res: Response;
  try {
    res = await fetch(`${issuer()}/api/v1/links`, {
      method: "POST",
      headers: { Authorization: basicAuth() ?? `Bearer ${await clientAssertion(`${issuer()}/api/v1`)}`, "Content-Type": "application/json" },
      body: JSON.stringify({ orgId: agency.id, orgName: agency.name, role: "Carer", ref: staff.id, inviteeName: `${staff.firstName} ${staff.lastName}`.trim() }),
      signal: AbortSignal.timeout(8_000),
    });
  } catch (error) {
    console.error("aultrum link failed", error);
    throw new Error("Aultrum isn't answering right now. Try again in a minute.");
  }
  const json = (await res.json().catch(() => ({}))) as Partial<AultrumLink> & { error?: string };
  if (!res.ok || !json.code || !json.url || !json.expiresAt) {
    console.error("aultrum link refused", res.status, json.error);
    throw new Error("Aultrum couldn't make the link. Try again in a minute.");
  }
  return { code: json.code, url: json.url, expiresAt: json.expiresAt };
}
