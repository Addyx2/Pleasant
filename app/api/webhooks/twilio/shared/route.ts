import { twiml } from "@/lib/integrations/twilio";
import { inboundToShared } from "@/lib/pushbots/inbound";
import { verifiedTwilioPost } from "@/lib/pushbots/twilio-request";

export const dynamic = "force-dynamic";

// Texts to the shared Pushbots number, used by agencies whose own number isn't bought yet.
export async function POST(request: Request) {
  const checked = await verifiedTwilioPost(request);
  if ("response" in checked) return checked.response;
  const reply = await inboundToShared(checked.fields.From, checked.fields.Body ?? "", checked.fields.MessageSid ?? null);
  return twiml(reply ?? undefined);
}
