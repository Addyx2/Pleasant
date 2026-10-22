"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { runAutomation } from "@/lib/assist/automations";
import { nextRun, parseTime } from "@/lib/assist/schedule";
import { requireOps, type SessionUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";

export interface AutomationFormState {
  error?: string;
  success?: string;
}

const MAX_PER_USER = 20;

const automationSchema = z
  .object({
    id: z.string().optional(),
    name: z.string().trim().min(2, "Give the automation a name").max(80),
    prompt: z.string().trim().min(10, "Describe what Assist should do (at least a sentence)").max(2000),
    cadence: z.enum(["DAILY", "WEEKDAYS", "WEEKLY"]),
    weekday: z.coerce.number().int().min(0).max(6).optional(),
    time: z.string().refine((t) => parseTime(t) !== null, "Choose a time"),
    emailResult: z.boolean(),
  })
  .refine((v) => v.cadence !== "WEEKLY" || v.weekday !== undefined, { message: "Choose a day", path: ["weekday"] });

/** Owners manage their own automations; admins can also pause, run or delete any in their agency. */
async function manageable(user: SessionUser, id: string, ownerOnly = false) {
  const automation = await prisma.assistAutomation.findFirst({ where: { id, agencyId: user.agencyId } });
  if (!automation) return null;
  if (automation.userId === user.id) return automation;
  return !ownerOnly && user.role === "ADMIN" ? automation : null;
}

export async function saveAutomationAction(
  _prev: AutomationFormState,
  formData: FormData,
): Promise<AutomationFormState> {
  const user = await requireOps();
  const parsed = automationSchema.safeParse({
    id: formData.get("id") || undefined,
    name: formData.get("name"),
    prompt: formData.get("prompt"),
    cadence: formData.get("cadence"),
    weekday: formData.get("cadence") === "WEEKLY" ? formData.get("weekday") : undefined,
    time: formData.get("time"),
    emailResult: formData.get("emailResult") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const d = parsed.data;
  const schedule = {
    cadence: d.cadence,
    weekday: d.cadence === "WEEKLY" ? (d.weekday ?? 1) : null,
    time: d.time,
  };
  const next = nextRun(schedule.cadence, schedule.weekday, schedule.time, new Date());

  if (d.id) {
    // Only the owner may change what an automation asks Assist to do.
    const existing = await manageable(user, d.id, true);
    if (!existing) return { error: "Automation not found" };
    await prisma.assistAutomation.update({
      where: { id: existing.id },
      data: { name: d.name, prompt: d.prompt, emailResult: d.emailResult, ...schedule, nextRunAt: next },
    });
    await recordAudit(user, {
      action: "assist.automation_update",
      summary: `Updated Assist automation "${d.name}"`,
      targetType: "AssistAutomation",
      targetId: existing.id,
    });
  } else {
    const count = await prisma.assistAutomation.count({ where: { userId: user.id } });
    if (count >= MAX_PER_USER) return { error: `You can have up to ${MAX_PER_USER} automations.` };
    const created = await prisma.assistAutomation.create({
      data: {
        agencyId: user.agencyId,
        userId: user.id,
        name: d.name,
        prompt: d.prompt,
        emailResult: d.emailResult,
        ...schedule,
        nextRunAt: next,
      },
    });
    await recordAudit(user, {
      action: "assist.automation_create",
      summary: `Created Assist automation "${d.name}"`,
      targetType: "AssistAutomation",
      targetId: created.id,
    });
  }

  revalidatePath("/assist/automations");
  return { success: d.id ? "Automation saved" : "Automation created" };
}

export async function toggleAutomationAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const automation = await manageable(user, String(formData.get("id") ?? ""));
  if (!automation) return;
  const enabled = formData.get("enabled") === "true";
  await prisma.assistAutomation.update({
    where: { id: automation.id },
    data: {
      enabled,
      // Resuming never back-fills missed runs: it starts from the next slot.
      ...(enabled
        ? { nextRunAt: nextRun(automation.cadence as "DAILY", automation.weekday, automation.time, new Date()), lastError: null }
        : {}),
    },
  });
  await recordAudit(user, {
    action: "assist.automation_toggle",
    summary: `${enabled ? "Resumed" : "Paused"} Assist automation "${automation.name}"`,
    targetType: "AssistAutomation",
    targetId: automation.id,
  });
  revalidatePath("/assist/automations");
}

export async function deleteAutomationAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const automation = await manageable(user, String(formData.get("id") ?? ""));
  if (!automation) return;
  await prisma.assistAutomation.delete({ where: { id: automation.id } });
  await recordAudit(user, {
    action: "assist.automation_delete",
    summary: `Deleted Assist automation "${automation.name}"`,
    targetType: "AssistAutomation",
    targetId: automation.id,
  });
  revalidatePath("/assist/automations");
}

export async function runAutomationNowAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const automation = await manageable(user, String(formData.get("id") ?? ""));
  if (!automation) return;
  const result = await runAutomation(automation.id, "manual");
  revalidatePath("/assist/automations");
  // The run is saved in the owner's private history; open it if that's you.
  if (result.conversationId && automation.userId === user.id) redirect(`/assist/c/${result.conversationId}`);
}
