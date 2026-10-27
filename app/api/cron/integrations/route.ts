import { timingSafeEqual } from "node:crypto";

import { schedulerConfigured } from "@/lib/assist/automations";
import { runIntegrationJobs } from "@/lib/integrations/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called by the same scheduler as /api/cron/assist, with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!schedulerConfigured()) {
    return Response.json({ error: "CRON_SECRET isn't set (16+ characters), so scheduled jobs are off." }, { status: 503 });
  }
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const result = await runIntegrationJobs({ budgetMs: 40_000 });
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
