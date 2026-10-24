import { timingSafeEqual } from "node:crypto";

import { runDueAutomations, schedulerConfigured } from "@/lib/assist/automations";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(request: Request): boolean {
  const expected = Buffer.from(`Bearer ${process.env.CRON_SECRET}`);
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// Called every few minutes by a scheduler (GitHub Actions workflow
// .github/workflows/assist-automations.yml, Vercel Cron on paid plans, or any
// cron service) with `Authorization: Bearer $CRON_SECRET`.
export async function GET(request: Request) {
  if (!schedulerConfigured()) {
    return Response.json({ error: "CRON_SECRET isn't set (16+ characters), so scheduled automations are off." }, { status: 503 });
  }
  if (!authorised(request)) return Response.json({ error: "Unauthorised" }, { status: 401 });
  const result = await runDueAutomations({ limit: 5, budgetMs: 35_000 });
  return Response.json({ ok: true, ...result }, { headers: { "Cache-Control": "no-store" } });
}
