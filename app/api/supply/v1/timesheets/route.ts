import { after } from "next/server";

import { maybeRunSignOffReminders } from "@/lib/sign-off-reminders";
import { supplyTimesheets } from "@/lib/supply";
import { json, supplyFromRequest, unauthorised } from "@/lib/supply-api";

export const dynamic = "force-dynamic";

/** GET /api/supply/v1/timesheets: the last 90 days, waiting and signed off. */
export async function GET(request: Request) {
  const supply = await supplyFromRequest(request);
  if (!supply) return unauthorised();
  after(() => maybeRunSignOffReminders());
  return json(await supplyTimesheets(supply.agencyId, supply.clientId));
}
