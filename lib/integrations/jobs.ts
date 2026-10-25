import { prisma } from "@/lib/db";

import { refreshBankHolidays } from "./bank-holidays";
import { syncXero } from "./xero/sync";

export const INTEGRATIONS_HEARTBEAT = "integrations";
const XERO_EVERY_MS = 60 * 60_000;
const HOLIDAYS_EVERY_MS = 20 * 60 * 60_000;

/**
 * Background work for integrations, run by the scheduler every few minutes:
 * the GOV.UK bank holidays about once a day, and each agency's Xero sync
 * about once an hour. Stops starting new work near the time budget.
 */
export async function runIntegrationJobs(options: { budgetMs?: number } = {}) {
  const started = Date.now();
  const budget = options.budgetMs ?? 40_000;
  const done: string[] = [];

  const holidays = await prisma.systemHeartbeat.findUnique({ where: { key: "bank-holidays" } });
  if (!holidays || Date.now() - holidays.at.getTime() > HOLIDAYS_EVERY_MS) {
    const result = await refreshBankHolidays();
    done.push(result.ok ? `bank holidays: ${result.count}` : `bank holidays failed: ${result.error}`);
  }

  const due = await prisma.integration.findMany({
    where: { provider: "xero", OR: [{ lastSyncAt: null }, { lastSyncAt: { lt: new Date(Date.now() - XERO_EVERY_MS) } }] },
    orderBy: { lastSyncAt: { sort: "asc", nulls: "first" } },
    take: 10,
  });
  for (const integration of due) {
    if (Date.now() - started > budget) break;
    const result = await syncXero(integration);
    done.push(`xero ${integration.agencyId}: ${result.ok ? "ok" : "failed"}`);
  }

  await prisma.systemHeartbeat.upsert({
    where: { key: INTEGRATIONS_HEARTBEAT },
    create: { key: INTEGRATIONS_HEARTBEAT, at: new Date(), detail: done.join("; ").slice(0, 300) || "nothing due" },
    update: { at: new Date(), detail: done.join("; ").slice(0, 300) || "nothing due" },
  });
  return { done };
}
