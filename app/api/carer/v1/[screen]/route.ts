import { after } from "next/server";

import { maybeTickPushbots } from "@/lib/pushbots/campaign";
import { maybeRunSignOffReminders } from "@/lib/sign-off-reminders";
import { carerFromRequest, json, unauthorised } from "@/lib/carer/api";
import { calendarScreen, homeScreen, passportScreen, peakScreen, poolScreen, timesheetsScreen } from "@/lib/carer/screens";

export const dynamic = "force-dynamic";

/** GET /api/carer/v1/{home|pool|calendar|passport|peak|timesheets}: one screen of the Aultrum carer app. */
export async function GET(request: Request, { params }: { params: Promise<{ screen: string }> }) {
  const carer = await carerFromRequest(request);
  if (!carer) return unauthorised();
  after(() => maybeRunSignOffReminders());
  after(() => maybeTickPushbots());
  const { screen } = await params;
  switch (screen) {
    case "home":
      return json(await homeScreen(carer));
    case "pool":
      return json(await poolScreen(carer));
    case "calendar":
      return json(await calendarScreen(carer, new URL(request.url).searchParams.get("month")));
    case "passport":
      return json(await passportScreen(carer));
    case "peak":
      return json(await peakScreen(carer));
    case "timesheets":
      return json(await timesheetsScreen(carer));
    default:
      return json({ error: "No such screen" }, 404);
  }
}
