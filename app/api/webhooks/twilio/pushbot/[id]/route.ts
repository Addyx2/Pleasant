import { twiml } from "@/lib/integrations/twilio";
import { inboundToPushbot } from "@/lib/pushbots/inbound";
import { verifiedTwilioPost } from "@/lib/pushbots/twilio-request";

export const dynamic = "force-dynamic";

// Texts to an agency's own Pushbot number (bought by Pleasant on Aultrum's Twilio account).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checked = await verifiedTwilioPost(request);
  if ("response" in checked) return checked.response;
  const reply = await inboundToPushbot(id, checked.fields.From, checked.fields.Body ?? "", checked.fields.MessageSid ?? null);
  return twiml(reply ?? undefined);
}
