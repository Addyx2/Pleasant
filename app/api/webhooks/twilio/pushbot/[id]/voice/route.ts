import { voiceTwiml } from "@/lib/integrations/twilio";
import { verifiedTwilioPost } from "@/lib/pushbots/twilio-request";
import { answerPushbotCall } from "@/lib/pushbots/voice";

export const dynamic = "force-dynamic";

// A call to an agency's Pushbot number: put through to the office, or told it's a texting number.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const checked = await verifiedTwilioPost(request);
  if ("response" in checked) return checked.response;
  return voiceTwiml(await answerPushbotCall(id, checked.fields.CallSid));
}
