import { voiceTwiml } from "@/lib/integrations/twilio";
import { verifiedTwilioPost } from "@/lib/pushbots/twilio-request";
import { sharedCallAnswer } from "@/lib/pushbots/voice";

export const dynamic = "force-dynamic";

// A call to the shared Pushbots number, which texts for many agencies.
export async function POST(request: Request) {
  const checked = await verifiedTwilioPost(request);
  if ("response" in checked) return checked.response;
  return voiceTwiml(sharedCallAnswer());
}
