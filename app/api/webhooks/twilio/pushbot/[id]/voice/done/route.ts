import { voiceTwiml } from "@/lib/integrations/twilio";
import { verifiedTwilioPost } from "@/lib/pushbots/twilio-request";
import { afterPushbotCall } from "@/lib/pushbots/voice";

export const dynamic = "force-dynamic";

// Twilio calls this when the office has been rung (answered, busy or no answer).
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checked = await verifiedTwilioPost(request);
  if ("response" in checked) return checked.response;
  return voiceTwiml(await afterPushbotCall(id, checked.fields));
}
