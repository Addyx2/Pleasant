import { createHmac, timingSafeEqual } from "node:crypto";

// Twilio's REST API (2010-04-01), called with each agency's own account.

export interface TwilioSecrets {
  accountSid: string;
  /** Checks Twilio's signature on incoming texts and calls; also signs requests when there's no API key. */
  authToken: string;
  /** A Twilio API key (SK...) and its secret: when set, requests to Twilio use it instead of the auth token. */
  apiKeySid?: string;
  apiKeySecret?: string;
}

export interface TwilioConfig {
  /** Sender: an E.164 number or a Messaging Service SID ("MG..."). */
  from: string;
  /** Send shift offers by text. */
  offers: boolean;
  /** Twilio account name, shown on the card. */
  accountName?: string;
  /** Whether Pleasant set the number's incoming-message webhook itself. */
  webhookSet?: boolean;
}

const base = () => (process.env.TWILIO_API_URL ?? "https://api.twilio.com").replace(/\/+$/, "");

/** Requests to Twilio sign in with the API key when there is one (revocable, scoped), else the auth token. */
export function twilioAuthHeader(s: TwilioSecrets) {
  const [user, pass] = s.apiKeySid && s.apiKeySecret ? [s.apiKeySid, s.apiKeySecret] : [s.accountSid, s.authToken];
  return `Basic ${Buffer.from(`${user}:${pass}`).toString("base64")}`;
}
const auth = twilioAuthHeader;

export class TwilioError extends Error {
  constructor(message: string, readonly status: number, readonly code?: number) {
    super(message);
  }
}

async function call<T>(s: TwilioSecrets, method: "GET" | "POST", path: string, form?: Record<string, string>): Promise<T> {
  const res = await fetch(`${base()}/2010-04-01/Accounts/${encodeURIComponent(s.accountSid)}${path}`, {
    method,
    headers: { Authorization: auth(s), ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}) },
    body: form ? new URLSearchParams(form).toString() : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
  if (!res.ok) {
    const reason = res.status === 401 ? "Twilio rejected the Account SID or Auth Token" : (json.message ?? `Twilio answered ${res.status}`);
    throw new TwilioError(reason, res.status, json.code);
  }
  return json;
}

export function looksLikeSid(sid: string) {
  return /^AC[0-9a-fA-F]{32}$/.test(sid);
}

/** Checks the credentials work; returns the account's name. */
export async function twilioAccount(s: TwilioSecrets): Promise<{ name: string; status: string }> {
  const json = await call<{ friendly_name?: string; status?: string }>(s, "GET", ".json");
  return { name: json.friendly_name ?? "Twilio account", status: json.status ?? "active" };
}

export async function sendSms(s: TwilioSecrets, from: string, to: string, body: string): Promise<{ sid: string }> {
  const sender: Record<string, string> = from.startsWith("MG") ? { MessagingServiceSid: from } : { From: from };
  const json = await call<{ sid: string }>(s, "POST", "/Messages.json", { To: to, Body: body, ...sender });
  return { sid: json.sid };
}

/**
 * Buys a UK mobile number that can send and receive texts, with its incoming
 * texts already pointed at `smsUrl`. UK numbers need a regulatory bundle
 * (proof of address) approved on the account: pass its SID, and the address
 * SID if Twilio asks for one.
 */
export async function buyUkMobile(
  s: TwilioSecrets,
  opts: { friendlyName: string; smsUrl: string; voiceUrl?: string; bundleSid?: string; addressSid?: string },
): Promise<{ sid: string; number: string }> {
  const found = await call<{ available_phone_numbers?: { phone_number: string }[] }>(
    s,
    "GET",
    "/AvailablePhoneNumbers/GB/Mobile.json?SmsEnabled=true&VoiceEnabled=true&PageSize=5",
  );
  const number = found.available_phone_numbers?.[0]?.phone_number;
  if (!number) throw new TwilioError("Twilio has no UK mobile numbers available to buy right now", 404);
  const bought = await call<{ sid: string; phone_number: string }>(s, "POST", "/IncomingPhoneNumbers.json", {
    PhoneNumber: number,
    FriendlyName: opts.friendlyName.slice(0, 64),
    SmsUrl: opts.smsUrl,
    SmsMethod: "POST",
    ...(opts.voiceUrl ? { VoiceUrl: opts.voiceUrl, VoiceMethod: "POST" } : {}),
    ...(opts.bundleSid ? { BundleSid: opts.bundleSid } : {}),
    ...(opts.addressSid ? { AddressSid: opts.addressSid } : {}),
  });
  return { sid: bought.sid, number: bought.phone_number };
}

const numbersBase = () => (process.env.TWILIO_NUMBERS_API_URL ?? process.env.TWILIO_API_URL ?? "https://numbers.twilio.com").replace(/\/+$/, "");

async function numbersCall<T>(s: TwilioSecrets, path: string): Promise<T> {
  const res = await fetch(`${numbersBase()}/v2/RegulatoryCompliance${path}`, { headers: { Authorization: auth(s) }, signal: AbortSignal.timeout(15_000) });
  const json = (await res.json().catch(() => ({}))) as T & { message?: string; code?: number };
  if (!res.ok) throw new TwilioError(res.status === 401 ? "Twilio rejected the Account SID or Auth Token" : (json.message ?? `Twilio answered ${res.status}`), res.status, json.code);
  return json;
}

/**
 * The account's approved UK mobile regulatory bundle and the address in it,
 * found through Twilio's API so nobody copies SIDs into settings. Settings
 * TWILIO_BUNDLE_SID / TWILIO_ADDRESS_SID still win if they're set.
 * Null when the account has no approved UK mobile bundle yet.
 */
export async function ukMobileBundle(s: TwilioSecrets): Promise<{ bundleSid: string; addressSid?: string } | null> {
  const setBundle = process.env.TWILIO_BUNDLE_SID?.trim();
  const setAddress = process.env.TWILIO_ADDRESS_SID?.trim() || undefined;
  if (setBundle) return { bundleSid: setBundle, addressSid: setAddress };
  const list = await numbersCall<{ results?: { sid: string }[] }>(s, "/Bundles?Status=twilio-approved&IsoCountry=GB&NumberType=mobile&PageSize=20");
  const bundleSid = list.results?.[0]?.sid;
  if (!bundleSid) return null;
  let addressSid = setAddress;
  if (!addressSid) {
    const items = await numbersCall<{ results?: { object_sid: string }[] }>(s, `/Bundles/${bundleSid}/ItemAssignments?PageSize=50`).catch(() => ({ results: [] }));
    addressSid = items.results?.find((i) => i.object_sid.startsWith("AD"))?.object_sid;
  }
  if (!addressSid) {
    const addresses = await call<{ addresses?: { sid: string }[] }>(s, "GET", "/Addresses.json?IsoCountry=GB&PageSize=20").catch(() => ({ addresses: [] }));
    addressSid = addresses.addresses?.[0]?.sid;
  }
  return { bundleSid, addressSid };
}

/** Points a number Pleasant already owns (by its SID) at a new address: its texts, and its calls if given. */
export async function pointNumber(s: TwilioSecrets, numberSid: string, smsUrl: string, voiceUrl?: string): Promise<void> {
  await call(s, "POST", `/IncomingPhoneNumbers/${numberSid}.json`, { SmsUrl: smsUrl, SmsMethod: "POST", ...(voiceUrl ? { VoiceUrl: voiceUrl, VoiceMethod: "POST" } : {}) });
}

/**
 * Points the sending number's incoming messages at Pleasant, so replies reach
 * the app. Returns false when the sender isn't a number on this account.
 */
export async function setIncomingWebhook(s: TwilioSecrets, number: string, url: string, voiceUrl?: string): Promise<boolean> {
  if (!number.startsWith("+")) return false;
  const list = await call<{ incoming_phone_numbers?: { sid: string }[] }>(
    s,
    "GET",
    `/IncomingPhoneNumbers.json?PhoneNumber=${encodeURIComponent(number)}`,
  );
  const sid = list.incoming_phone_numbers?.[0]?.sid;
  if (!sid) return false;
  await call(s, "POST", `/IncomingPhoneNumbers/${sid}.json`, { SmsUrl: url, SmsMethod: "POST", ...(voiceUrl ? { VoiceUrl: voiceUrl, VoiceMethod: "POST" } : {}) });
  return true;
}

/**
 * Twilio signs each webhook: base64 HMAC-SHA1, keyed with the auth token, of
 * the full URL followed by every POST parameter's name and value, sorted by name.
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function validTwilioSignature(authToken: string, signature: string | null, urls: string[], params: Record<string, string>): boolean {
  if (!signature) return false;
  const given = Buffer.from(signature);
  return urls.some((url) => {
    const expected = Buffer.from(twilioSignature(authToken, url, params));
    return expected.length === given.length && timingSafeEqual(expected, given);
  });
}

export interface OfferReply {
  accept: boolean;
  code: string | null;
}

const YES = new Set(["YES", "Y", "YEAH", "YEP", "ACCEPT", "OK", "OKAY"]);
const NO = new Set(["NO", "N", "NOPE", "DECLINE", "PASS"]);

/** Reads "YES", "yes 4821", "No, 4821" and so on. Null when it isn't an answer. */
export function parseOfferReply(body: string): OfferReply | null {
  const words = body.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return null;
  const answer = words.find((w) => YES.has(w) || NO.has(w));
  if (!answer) return null;
  const code = words.find((w) => /^\d{4}$/.test(w)) ?? null;
  return { accept: YES.has(answer), code };
}

export function twiml(message?: string): Response {
  const escaped = message?.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);
  const body = `<?xml version="1.0" encoding="UTF-8"?><Response>${escaped ? `<Message>${escaped}</Message>` : ""}</Response>`;
  return new Response(body, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

const xml = (text: string) => text.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

/** Spoken words for a call, in a British voice. */
export const say = (text: string) => `<Say voice="Polly.Amy-Neural" language="en-GB">${xml(text)}</Say>`;

/** A TwiML answer to a call. */
export function voiceTwiml(inner: string): Response {
  return new Response(`<?xml version="1.0" encoding="UTF-8"?><Response>${inner}</Response>`, { headers: { "Content-Type": "text/xml; charset=utf-8" } });
}

export const dialTwiml = (to: string, opts: { action: string; timeLimitSecs: number }) =>
  `<Dial timeout="25" timeLimit="${opts.timeLimitSecs}" action="${xml(opts.action)}" method="POST">${xml(to)}</Dial>`;
