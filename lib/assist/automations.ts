import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Prisma } from "@prisma/client";
import { format } from "date-fns";

import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { isOpsRole } from "@/lib/permissions";
import { absoluteUrl } from "@/lib/url";

import { runAssist } from "./agent";
import { nextRun, type Cadence } from "./schedule";

export const SCHEDULER_KEY = "assist-scheduler";

/** The scheduler endpoint only accepts a secret of at least 16 characters. */
export function schedulerConfigured(): boolean {
  return (process.env.CRON_SECRET ?? "").length >= 16;
}

export interface AutomationRunResult {
  ok: boolean;
  conversationId?: string;
  error?: string;
}

/**
 * Run one automation as its owner, with read-only tools: nobody is there to
 * confirm a change. The result is saved as a conversation in the owner's
 * Assist history (where they can continue it and approve any changes) and
 * optionally emailed to them.
 */
export async function runAutomation(automationId: string, trigger: "schedule" | "manual"): Promise<AutomationRunResult> {
  const automation = await prisma.assistAutomation.findUnique({ where: { id: automationId } });
  if (!automation) return { ok: false, error: "Automation not found" };

  const owner = await prisma.user.findUnique({
    where: { id: automation.userId },
    include: { agency: true, staff: true },
  });
  if (!owner || owner.deactivatedAt || !isOpsRole(owner.role) || owner.agencyId !== automation.agencyId) {
    await prisma.assistAutomation.update({
      where: { id: automation.id },
      data: { enabled: false, lastStatus: "FAILED", lastError: "Paused: the owner no longer has back-office access.", lastRunAt: new Date() },
    });
    return { ok: false, error: "The owner no longer has access" };
  }

  const startedAt = new Date();
  let messages: BetaMessageParam[] = [{ role: "user", content: automation.prompt }];
  let report = "";
  let error: string | undefined;

  try {
    const events = runAssist(owner, messages, {}, {
      scope: { disabled: owner.agency.assistDisabled, readOnly: true },
      automation: { name: automation.name },
    });
    for await (const event of events) {
      if (event.type === "text") report += event.delta;
      else if (event.type === "state") messages = event.messages;
      else if (event.type === "error") error = event.message;
      else if (event.type === "tool") report = ""; // keep only the final answer, after the last tool call
    }
  } catch (e) {
    console.error("assist automation failed", automation.id, e);
    error = e instanceof Error && /api key|credentials/i.test(e.message)
      ? "Assist isn't set up: add ANTHROPIC_API_KEY."
      : "The run failed before it could finish.";
  }

  const conversation = await prisma.assistConversation.create({
    data: {
      agencyId: automation.agencyId,
      userId: automation.userId,
      automationId: automation.id,
      title: `${automation.name} · ${format(startedAt, "d MMM, HH:mm")}`,
      messages: messages as unknown as Prisma.InputJsonValue,
    },
  });

  const ok = !error && report.trim().length > 0;
  await prisma.assistAutomation.update({
    where: { id: automation.id },
    data: {
      lastRunAt: startedAt,
      lastStatus: ok ? "OK" : "FAILED",
      lastError: ok ? null : (error ?? "Assist didn't produce a report."),
      // Manual runs don't move the schedule; scheduled runs were advanced when claimed.
      ...(trigger === "manual" ? {} : { nextRunAt: nextRun(automation.cadence as Cadence, automation.weekday, automation.time, new Date()) }),
    },
  });

  if (ok && automation.emailResult && owner.email) {
    const link = await absoluteUrl(`/persona/assist/c/${conversation.id}`);
    await sendEmail({
      to: owner.email,
      subject: `Persona Assist: ${automation.name}`,
      text: `${report.trim()}\n\n—\nOpen in Pleasant to continue, or to ask Assist to make any suggested changes:\n${link}\n\nYou're receiving this because you scheduled "${automation.name}" in Persona → Assist → Automations.`,
    });
  }

  await recordAudit(owner, {
    action: "assist.automation_run",
    summary: `${trigger === "manual" ? "Ran" : "Scheduled run of"} automation "${automation.name}"${ok ? "" : " (failed)"}`,
    targetType: "AssistAutomation",
    targetId: automation.id,
    metadata: { trigger, ok },
  });

  return { ok, conversationId: conversation.id, error: ok ? undefined : (error ?? "Assist didn't produce a report.") };
}

/**
 * Run automations that are due. Each is claimed by moving its next run time
 * forward in a conditional update, so overlapping scheduler calls can't run
 * the same automation twice.
 */
export async function runDueAutomations(options: { limit?: number; budgetMs?: number } = {}) {
  const started = Date.now();
  const now = new Date();
  await prisma.systemHeartbeat.upsert({
    where: { key: SCHEDULER_KEY },
    create: { key: SCHEDULER_KEY, at: now },
    update: { at: now },
  });

  const due = await prisma.assistAutomation.findMany({
    where: { enabled: true, nextRunAt: { lte: now } },
    orderBy: { nextRunAt: "asc" },
    take: options.limit ?? 5,
  });

  const results: { id: string; ok: boolean }[] = [];
  for (const automation of due) {
    // Stop starting new runs near the function's time limit; the rest stay due.
    if (Date.now() - started > (options.budgetMs ?? 35_000)) break;
    const next = nextRun(automation.cadence as Cadence, automation.weekday, automation.time, now);
    const claimed = await prisma.assistAutomation.updateMany({
      where: { id: automation.id, nextRunAt: automation.nextRunAt, enabled: true },
      data: { nextRunAt: next },
    });
    if (claimed.count === 0) continue;
    const result = await runAutomation(automation.id, "schedule");
    results.push({ id: automation.id, ok: result.ok });
  }

  await prisma.systemHeartbeat.update({
    where: { key: SCHEDULER_KEY },
    data: { detail: `${results.length} run(s), ${due.length} due` },
  });
  return { due: due.length, ran: results };
}
