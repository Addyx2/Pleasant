"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendAndKeep } from "@/lib/integrations/sms";
import { toE164 } from "@/lib/integrations/phone";
import { cancelCampaign, startCampaign } from "@/lib/pushbots/campaign";

const done = () => {
  revalidatePath("/persona/pushbots");
  revalidatePath("/shifts");
  revalidatePath("/dispatch");
};

export async function startCampaignAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const shiftId = String(formData.get("shiftId") ?? "");
  const waveSize = Number(formData.get("waveSize") ?? 5);
  const waveGapMins = Number(formData.get("waveGapMins") ?? 15);
  const result = await startCampaign(user.agencyId, shiftId, user.id, { waveSize, waveGapMins });
  if (result.ok) await recordAudit(user, { action: "pushbots.start", summary: `Pushbots started filling a shift (${result.offered} offered in the first wave)`, targetType: "shift", targetId: shiftId });
  done();
  redirect(`/persona/pushbots?${result.ok ? "started=1" : `error=${encodeURIComponent(result.error)}`}`);
}

export async function stopCampaignAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  await cancelCampaign(user.agencyId, String(formData.get("campaignId") ?? ""), user);
  done();
  redirect("/persona/pushbots");
}

/** The office texts a carer from the Texts tab. */
export async function replyAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const staffId = String(formData.get("staffId") ?? "");
  const body = String(formData.get("body") ?? "").trim().slice(0, 600);
  const staff = await prisma.staffProfile.findFirst({ where: { id: staffId, agencyId: user.agencyId }, select: { id: true, phone: true, smsOptOutAt: true } });
  const phone = toE164(staff?.phone);
  let error = "";
  if (!staff || !phone) error = "That carer has no mobile number on file.";
  else if (staff.smsOptOutAt) error = "That carer has texted STOP, so they can't be texted.";
  else if (!body) error = "Write a message first.";
  else {
    const sent = await sendAndKeep(user.agencyId, staff.id, phone, body, `Office text from ${user.firstName}`);
    if (!sent.sent) error = sent.reason ?? "The text couldn't be sent.";
    else await recordAudit(user, { action: "pushbots.reply", summary: "Texted a carer from Pushbots", targetType: "staff", targetId: staff.id });
  }
  revalidatePath(`/persona/pushbots/messages/${staffId}`);
  redirect(`/persona/pushbots/messages/${staffId}${error ? `?error=${encodeURIComponent(error)}` : "?sent=1"}`);
}
