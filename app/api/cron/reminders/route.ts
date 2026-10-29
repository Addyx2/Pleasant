import { timingSafeEqual } from "node:crypto";

import { schedulerConfigured } from "@/lib/assist/automations";
import { runSignOffReminders } from "@/lib/sign-off-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Daily sign-off reminders (vercel.json), with `Authorization: Bearer $CRON_SECRET`.
// Without a CRON_SECRET they still go out: the app runs them hourly as it's used.
export async function GET(request: Request) {
  if (!schedulerConfigured()) return Response.json({ error: "CRON_SECRET isn't set, so this daily run is off; reminders still run as the app is used." }, { status: 503 });
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  return Response.json({ ok: true, ...(await runSignOffReminders()) }, { headers: { "Cache-Control": "no-store" } });
}
