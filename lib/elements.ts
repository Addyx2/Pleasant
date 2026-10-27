import { createHash } from "node:crypto";

import type { AddonKey } from "@prisma/client";
import { createRemoteJWKSet, jwtVerify } from "jose";

import { signedAssertion } from "@/lib/aultrum-id";
import { prisma } from "@/lib/db";

// Aultrum Elements (Gateway and Peak) run in the Elements console at
// canvas.aultrum.co.uk. Pleasant switches them on per agency, shows their
// screens, sends them events (clock-ins, completed shifts, people) and acts
// on the events they send back.
//
// Nothing to set up: Pleasant proves who it is by signing each request with
// the key it publishes at /.well-known/jwks.json, and checks the console's
// webhooks against the console's own published key. ELEMENTS_URL and
// APP_URL override the addresses, e.g. for local development.

const live = process.env.NODE_ENV === "production" && process.env.AULTRUM_LOCAL !== "1";
export const elementsUrl = () => (process.env.ELEMENTS_URL ?? (live ? "https://canvas.aultrum.co.uk" : "http://localhost:3200")).replace(/\/+$/, "");
const pleasantOrigin = () => (process.env.APP_URL ?? (live ? "https://pleasant.aultrum.co.uk" : "http://localhost:3100")).replace(/\/+$/, "");
/** How the console knows Pleasant: the host its key is published on. */
export const elementsClientId = () => new URL(pleasantOrigin()).host;

export const MODULE_KEY: Record<AddonKey, string> = { GATEWAY: "gateway", PEAK: "peak" };

export class ElementsError extends Error {}

async function call(path: string, init: { method?: string; body?: unknown } = {}): Promise<Record<string, unknown>> {
  const token = await signedAssertion(elementsClientId(), new URL(elementsUrl()).origin);
  let res: Response;
  try {
    res = await fetch(`${elementsUrl()}${path}`, {
      method: init.method ?? (init.body ? "POST" : "GET"),
      headers: { Authorization: `Bearer ${token}`, ...(init.body ? { "Content-Type": "application/json" } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
  } catch {
    throw new ElementsError("Elements can't be reached right now. Try again in a minute.");
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (res.status === 401) throw new ElementsError("Pleasant isn't connected to Elements yet. In the Elements console, open Systems and choose Connect Pleasant.");
  if (!res.ok) throw new ElementsError(typeof json.error === "string" ? json.error : `Elements answered ${res.status}`);
  return json;
}

/** Switch an Element on for an agency; returns the console's installation ID. */
export async function installElement(agency: { id: string; name: string }, key: AddonKey): Promise<string> {
  const json = await call("/api/v1/installations", { body: { module: MODULE_KEY[key], tenantId: agency.id, tenantName: agency.name } });
  if (typeof json.id !== "string") throw new ElementsError("Elements didn't return an installation");
  return json.id;
}

export async function uninstallElement(installationId: string): Promise<void> {
  await call(`/api/v1/installations/${encodeURIComponent(installationId)}`, { method: "DELETE" });
}

/** A five-minute address for showing an Element's screen inside Pleasant. */
export async function elementScreenUrl(
  installationId: string,
  user: { id: string; name: string; role: "manager" | "member"; personId?: string },
): Promise<string> {
  const json = await call("/api/v1/embed-tokens", { body: { installationId, user } });
  if (typeof json.url !== "string") throw new ElementsError("Elements didn't return a screen");
  return json.url;
}

export async function installationFor(agencyId: string, key: AddonKey): Promise<string | null> {
  const row = await prisma.agencyAddon.findUnique({
    where: { agencyId_key: { agencyId, key } },
    select: { installed: true, active: true, elementsInstallationId: true },
  });
  return row?.installed && row.active ? row.elementsInstallationId : null;
}

/**
 * Tell an Element something happened, e.g. a clock-in for Peak. Best effort:
 * a failure is logged and never stops the work the user was doing.
 */
export async function sendElementEvent(agencyId: string, key: AddonKey, type: string, data: Record<string, unknown>): Promise<void> {
  try {
    const installationId = await installationFor(agencyId, key);
    if (!installationId) return;
    await call(`/api/v1/installations/${encodeURIComponent(installationId)}/events`, { body: { type, data } });
  } catch (error) {
    console.error("elements event not sent", key, type, error instanceof Error ? error.message : error);
  }
}

// ---------------------------------------------------------------- webhooks from the console

const keys = new Map<string, ReturnType<typeof createRemoteJWKSet>>();
function consoleKeys() {
  const uri = `${elementsUrl()}/.well-known/jwks.json`;
  let set = keys.get(uri);
  if (!set) {
    set = createRemoteJWKSet(new URL(uri), { cacheMaxAge: 10 * 60_000, cooldownDuration: 30_000 });
    keys.set(uri, set);
  }
  return set;
}

/** Check a webhook came from the Elements console and wasn't changed on the way. */
export async function verifyElementsWebhook(rawBody: string, authorization: string | null): Promise<boolean> {
  if (!authorization?.startsWith("Bearer ")) return false;
  try {
    const { payload } = await jwtVerify(authorization.slice(7), consoleKeys(), {
      issuer: new URL(elementsUrl()).origin,
      audience: elementsClientId(),
      maxTokenAge: "5m",
    });
    const hash = createHash("sha256").update(rawBody).digest("base64url");
    return payload.body_sha256 === hash;
  } catch {
    return false;
  }
}
