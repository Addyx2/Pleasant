"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";

import { ASSIST_MODEL } from "@/lib/assist/agent";
import { ASSIST_GROUPS, normalisePolicy, policyKey } from "@/lib/assist/policy";
import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";

export interface TestState {
  ok?: boolean;
  message?: string;
}

/** Checks the API key reaches Anthropic and can see Assist's model. No tokens are spent. */
export async function testModelAction(_prev: TestState): Promise<TestState> {
  await requireAdmin();
  try {
    const model = await new Anthropic().models.retrieve(ASSIST_MODEL);
    return { ok: true, message: `Connected. ${model.display_name} is available.` };
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) return { ok: false, message: "The API key was rejected. Check ANTHROPIC_API_KEY." };
    if (error instanceof Anthropic.PermissionDeniedError) return { ok: false, message: "This API key can't use Assist's model." };
    if (error instanceof Anthropic.NotFoundError) return { ok: false, message: `Model ${ASSIST_MODEL} isn't available to this key.` };
    if (error instanceof Anthropic.APIConnectionError) return { ok: false, message: "Couldn't reach Anthropic from the server." };
    if (error instanceof Anthropic.APIError) return { ok: false, message: `Anthropic returned an error (${error.status}).` };
    return { ok: false, message: "No API key is set. Add ANTHROPIC_API_KEY to the environment." };
  }
}

export async function sendTestEmailAction(_prev: TestState): Promise<TestState> {
  const user = await requireAdmin();
  const { delivered } = await sendEmail({
    to: user.email,
    subject: "Pleasant test email",
    text: `This is a test from Persona → Assist → Connections in ${user.agency.name}. If you can read it, automation results can be emailed.`,
  });
  return delivered
    ? { ok: true, message: `Sent to ${user.email}.` }
    : { ok: false, message: "Not sent. Check RESEND_API_KEY and EMAIL_FROM (the sending domain must be verified in Resend)." };
}

export async function saveAssistPolicyAction(formData: FormData): Promise<void> {
  const user = await requireAdmin();
  const disabled: string[] = [];
  for (const g of ASSIST_GROUPS) {
    if (formData.get(`${g.key}:read`) !== "on") disabled.push(policyKey(g.key, "read"));
    if (formData.get(`${g.key}:write`) !== "on") disabled.push(policyKey(g.key, "write"));
  }
  const next = normalisePolicy(disabled);
  const before = user.agency.assistDisabled;
  if (JSON.stringify(next) === JSON.stringify([...before].sort())) return;

  await prisma.agency.update({ where: { id: user.agencyId }, data: { assistDisabled: next } });
  const describe = (list: string[]) => list.map((k) => k.replace(":read", " (read)").replace(":write", " (change)")).join(", ");
  const added = next.filter((k) => !before.includes(k));
  const removed = before.filter((k) => !next.includes(k));
  await recordAudit(user, {
    action: "assist.policy",
    summary: [added.length ? `Turned off ${describe(added)}` : null, removed.length ? `turned on ${describe(removed)}` : null]
      .filter(Boolean)
      .join("; ")
      .replace(/^t/, "T") + " for Assist",
    targetType: "Agency",
    targetId: user.agencyId,
    metadata: { disabled: next },
  });
  revalidatePath("/persona/assist/connections");
}
