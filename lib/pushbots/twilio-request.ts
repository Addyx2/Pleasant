import { sharedSender } from "@/lib/integrations/sms";
import { validTwilioSignature } from "@/lib/integrations/twilio";
import { defaultOrigin } from "@/lib/url";

/**
 * A text Twilio posted to one of Aultrum's numbers, checked: the
 * X-Twilio-Signature header must match Aultrum's auth token for the address
 * Twilio called. Returns the form fields, or the response to send instead.
 */
export async function verifiedTwilioPost(request: Request): Promise<{ fields: Record<string, string> } | { response: Response }> {
  const account = sharedSender();
  if (!account) return { response: new Response("Not found", { status: 404 }) };
  const form = await request.formData().catch(() => null);
  if (!form) return { response: new Response("Bad request", { status: 400 }) };
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;

  // Twilio signs the public URL it called; behind a proxy request.url may differ.
  const path = new URL(request.url).pathname;
  const urls = [request.url, `${(process.env.APP_URL ?? defaultOrigin()).replace(/\/+$/, "")}${path}`];
  if (!validTwilioSignature(account.secrets.authToken, request.headers.get("x-twilio-signature"), urls, fields)) {
    return { response: new Response("Invalid signature", { status: 403 }) };
  }
  if (fields.AccountSid !== account.secrets.accountSid || !fields.From) return { response: new Response(null, { status: 204 }) };
  return { fields };
}
