"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";

import { recordAudit } from "@/lib/audit";
import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sendAndKeep } from "@/lib/integrations/sms";
import { toE164 } from "@/lib/integrations/phone";
import { cancelCampaign, startCampaign } from "@/lib/pushbots/campaign";
import { provisionNumber } from "@/lib/pushbots/number";

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

const pushbotFields = (formData: FormData) => ({
  name: String(formData.get("name") ?? "").trim().slice(0, 40) || "Pushbot",
  tone: ["friendly", "brief", "formal"].includes(String(formData.get("tone"))) ? String(formData.get("tone")) : "friendly",
  enabled: formData.get("enabled") === "on",
  officeTexts: formData.get("officeTexts") === "on",
  waveSize: Math.min(20, Math.max(1, Math.round(Number(formData.get("waveSize")) || 5))),
  waveGapMins: Math.min(240, Math.max(5, Math.round(Number(formData.get("waveGapMins")) || 15))),
});

/** Creates or updates the agency's Pushbot; a new (or numberless) one gets its number straight away. */
export async function savePushbotAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  if (user.role !== "ADMIN") redirect("/persona/pushbots/settings?error=Only%20an%20admin%20can%20change%20the%20Pushbot.");
  const data = pushbotFields(formData);
  const existing = await prisma.pushbot.findUnique({ where: { agencyId: user.agencyId } });
  const pushbot = await prisma.pushbot.upsert({ where: { agencyId: user.agencyId }, create: { agencyId: user.agencyId, ...data }, update: data });
  await recordAudit(user, { action: existing ? "pushbot.update" : "pushbot.create", summary: `${existing ? "Changed" : "Created"} the Pushbot "${pushbot.name}"` });
  if (pushbot.enabled && pushbot.numberStatus !== "active") after(() => provisionNumber(pushbot.id));
  revalidatePath("/persona/pushbots");
  redirect(`/persona/pushbots/settings?saved=${existing ? "1" : "new"}`);
}

export async function retryNumberAction(): Promise<void> {
  const user = await requireOps();
  if (user.role !== "ADMIN") redirect("/persona/pushbots/settings");
  const pushbot = await prisma.pushbot.findUnique({ where: { agencyId: user.agencyId } });
  if (pushbot) await provisionNumber(pushbot.id);
  revalidatePath("/persona/pushbots/settings");
  redirect("/persona/pushbots/settings");
}

/** An admin registers (or clears) an office member's mobile: texts from it reach the Pushbot as them. */
export async function setOfficeMobileAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  if (user.role !== "ADMIN") redirect("/persona/pushbots/settings");
  const userId = String(formData.get("userId") ?? "");
  const raw = String(formData.get("mobile") ?? "").trim();
  const mobile = raw ? toE164(raw) : null;
  if (raw && !mobile) redirect(`/persona/pushbots/settings?error=${encodeURIComponent(`"${raw}" isn't a mobile number Pleasant can text.`)}`);
  const member = await prisma.user.findFirst({ where: { id: userId, agencyId: user.agencyId, role: { in: ["ADMIN", "MANAGER"] } } });
  if (!member) redirect("/persona/pushbots/settings");
  if (mobile) {
    const clash = await prisma.user.findFirst({ where: { agencyId: user.agencyId, mobile, id: { not: member.id } }, select: { firstName: true } });
    if (clash) redirect(`/persona/pushbots/settings?error=${encodeURIComponent(`That mobile is already ${clash.firstName}'s.`)}`);
  }
  await prisma.user.update({ where: { id: member.id }, data: { mobile } });
  await recordAudit(user, { action: "pushbot.mobile", summary: `${mobile ? "Registered" : "Removed"} ${member.firstName} ${member.lastName}'s mobile for texting the Pushbot`, targetType: "user", targetId: member.id });
  revalidatePath("/persona/pushbots/settings");
  redirect("/persona/pushbots/settings?saved=1");
}
