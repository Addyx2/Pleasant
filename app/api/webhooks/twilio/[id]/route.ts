import { prisma } from "@/lib/db";
import { handleInboundSms } from "@/lib/integrations/sms-offers";
import { secretsOf } from "@/lib/integrations/store";
import { twiml, validTwilioSignature, type TwilioSecrets } from "@/lib/integrations/twilio";

export const dynamic = "force-dynamic";

// Twilio posts each text sent to the agency's number here. The path names
// the agency's integration; the X-Twilio-Signature header, keyed with that
// integration's auth token, proves the request came from Twilio.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const integration = await prisma.integration.findFirst({ where: { id, provider: "twilio" } });
  const secrets = secretsOf<TwilioSecrets>(integration);
  if (!integration || !secrets) return new Response("Not found", { status: 404 });

  const form = await request.formData().catch(() => null);
  if (!form) return new Response("Bad request", { status: 400 });
  const fields: Record<string, string> = {};
  for (const [k, v] of form.entries()) if (typeof v === "string") fields[k] = v;

  // Twilio signs the public URL it called. Behind a proxy request.url may
  // differ, so APP_URL's version is accepted too.
  const path = new URL(request.url).pathname;
  const urls = [request.url];
  if (process.env.APP_URL) urls.push(`${process.env.APP_URL.replace(/\/+$/, "")}${path}`);
  if (!validTwilioSignature(secrets.authToken, request.headers.get("x-twilio-signature"), urls, fields)) {
    return new Response("Invalid signature", { status: 403 });
  }
  if (fields.AccountSid !== secrets.accountSid || !fields.From) return twiml();

  const reply = await handleInboundSms(integration, fields.From, fields.Body ?? "", fields.MessageSid ?? null);
  return twiml(reply ?? undefined);
}
