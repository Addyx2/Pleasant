import type { PushbotCampaign } from "@prisma/client";

import { recordAudit, type AuditActor } from "@/lib/audit";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { textStaff } from "@/lib/integrations/sms";
import { sendOfferSms } from "@/lib/integrations/sms-offers";
import { absoluteUrl } from "@/lib/url";

import { rankForShift } from "./eligibility";

// Pushbots fills an open shift by itself: it offers it to the best-placed
// eligible carers a few at a time (a "wave"), by text and in the app, and
// waits. The first to say YES gets it, and everyone else still holding the
// offer is told it's gone. If nobody takes it, the next wave goes out; when
// there's nobody left, or the shift is about to start, the office is told.

const DAY = 86_400_000;

export type StartResult = { ok: true; campaignId: string; offered: number } | { ok: false; error: string };

export async function startCampaign(agencyId: string, shiftId: string, startedById: string | null, opts: { waveSize?: number; waveGapMins?: number } = {}): Promise<StartResult> {
  const shift = await prisma.shift.findFirst({ where: { id: shiftId, agencyId }, select: { id: true, status: true, staffId: true, startAt: true, role: true } });
  if (!shift) return { ok: false, error: "Shift not found." };
  if (shift.staffId) return { ok: false, error: "That shift already has a carer." };
  if (shift.status !== "OPEN" && shift.status !== "UNATTENDED") return { ok: false, error: "Only an open shift can be filled." };
  if (shift.startAt.getTime() <= Date.now()) return { ok: false, error: "That shift has already started." };
  const running = await prisma.pushbotCampaign.findFirst({ where: { shiftId, status: "RUNNING" }, select: { id: true } });
  if (running) return { ok: false, error: "Pushbots is already filling this shift." };

  // An unattended shift (its carer dropped out) is offered like an open one.
  if (shift.status === "UNATTENDED") await prisma.shift.update({ where: { id: shift.id }, data: { status: "OPEN" } });

  const campaign = await prisma.pushbotCampaign.create({
    data: {
      agencyId,
      shiftId,
      targetRole: shift.role,
      channel: "SMS",
      status: "RUNNING",
      startedById,
      waveSize: clamp(opts.waveSize ?? 5, 1, 20),
      waveGapMins: clamp(opts.waveGapMins ?? 15, 5, 240),
    },
  });
  await log(agencyId, "CAMPAIGN_STARTED", { campaignId: campaign.id, shiftId });
  const offered = await runWave(campaign);
  return { ok: true, campaignId: campaign.id, offered };
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(n)));

/** Offers the shift to the next few carers. Returns how many were offered. */
async function runWave(campaign: PushbotCampaign): Promise<number> {
  const ranking = await rankForShift(campaign.agencyId, campaign.shiftId);
  if (!ranking) return 0;
  const next = ranking.ranked.slice(0, campaign.waveSize);
  if (next.length === 0) {
    const waiting = await prisma.shiftOffer.count({ where: { campaignId: campaign.id, status: "OFFERED" } });
    // Wait for the last wave's answers before giving up.
    if (waiting === 0 || campaign.wave === 0) await finish(campaign, "exhausted");
    else await prisma.pushbotCampaign.update({ where: { id: campaign.id }, data: { nextWaveAt: new Date(Date.now() + campaign.waveGapMins * 60_000) } });
    return 0;
  }

  let texted = 0;
  for (const c of next) {
    const offer = await prisma.shiftOffer.upsert({
      where: { shiftId_staffId: { shiftId: campaign.shiftId, staffId: c.staffId } },
      create: { agencyId: campaign.agencyId, shiftId: campaign.shiftId, staffId: c.staffId, campaignId: campaign.id, note: c.why },
      update: { status: "OFFERED", respondedAt: null, campaignId: campaign.id, note: c.why },
    });
    if (c.textable && (await sendOfferSms(campaign.agencyId, offer.id)).sent) texted++;
  }
  await prisma.pushbotCampaign.update({
    where: { id: campaign.id },
    data: { wave: { increment: 1 }, offersSent: { increment: next.length }, nextWaveAt: new Date(Date.now() + campaign.waveGapMins * 60_000) },
  });
  await log(campaign.agencyId, "WAVE_SENT", { campaignId: campaign.id, wave: campaign.wave + 1, offered: next.length, texted });
  return next.length;
}

/** Ends a campaign, closing its open offers, and tells the people who need to know. */
async function finish(campaign: PushbotCampaign, outcome: "filled" | "exhausted" | "expired" | "cancelled", claimedById?: string | null) {
  const ended = await prisma.pushbotCampaign.updateMany({
    where: { id: campaign.id, status: "RUNNING" },
    data: { status: outcome === "filled" ? "COMPLETED" : outcome === "cancelled" ? "CANCELLED" : "EXPIRED", outcome, endedAt: new Date(), nextWaveAt: null, claimedById: claimedById ?? null },
  });
  if (ended.count === 0) return; // another server finished it first

  const open = await prisma.shiftOffer.findMany({ where: { campaignId: campaign.id, status: "OFFERED" }, select: { id: true, staffId: true } });
  await prisma.shiftOffer.deleteMany({ where: { id: { in: open.map((o) => o.id) } } });
  const shift = await prisma.shift.findUnique({ where: { id: campaign.shiftId }, include: { client: true, site: true, agency: { select: { name: true } } } });
  if (!shift) return;
  const label = shiftLabel(shift);

  if (outcome === "filled") {
    // Everyone still holding the offer by text hears it's gone, so nobody turns up unbooked.
    const texted = await prisma.smsMessage.findMany({ where: { offerId: { in: open.map((o) => o.id) }, direction: "OUT", status: "SENT" }, select: { staffId: true } });
    for (const staffId of new Set(texted.map((t) => t.staffId).filter((s): s is string => !!s))) {
      await textStaff(campaign.agencyId, staffId, `${shift.agency.name}: the ${label} shift has been filled. Thanks, no need to reply.`, "Shift filled");
    }
  }
  if (outcome === "exhausted" || outcome === "expired") await alertOffice(campaign.agencyId, shift.id, outcome, label);
  await log(campaign.agencyId, outcome === "filled" ? "SHIFT_CLAIMED" : `CAMPAIGN_${outcome.toUpperCase()}`, { campaignId: campaign.id, shiftId: shift.id, claimedById });
}

function shiftLabel(shift: { startAt: Date; endAt: Date; client: Parameters<typeof clientName>[0]; site: { name: string } | null; title: string }) {
  const day = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  const place = [clientName(shift.client, ""), shift.site?.name].filter(Boolean).join(", ") || shift.title;
  return `${day.format(shift.startAt)} ${place}`;
}

async function alertOffice(agencyId: string, shiftId: string, outcome: "exhausted" | "expired", label: string) {
  const ops = await prisma.user.findMany({ where: { agencyId, role: { in: ["ADMIN", "MANAGER"] }, deactivatedAt: null }, select: { email: true } });
  const why = outcome === "exhausted" ? "Pushbots has offered it to every eligible carer and nobody has taken it." : "The shift is about to start and nobody has taken it.";
  const link = await absoluteUrl(`/shifts/${shiftId}`);
  const text = `${why}\n\nShift: ${label}\nOpen it: ${link}\n\nThe Pushbots page shows who was offered it and why others weren't.`;
  for (const u of ops) await sendEmail({ to: u.email, subject: `Not filled: ${label}`, text }).catch(() => undefined);
}

async function log(agencyId: string, action: string, details: Record<string, unknown>) {
  await prisma.agentLog.create({ data: { agencyId, agentName: "PUSHBOTS", action, details: JSON.stringify(details), status: "SUCCESS" } });
}

/** A carer has just taken a shift: end its campaign and tell the others. */
export async function settleShift(shiftId: string): Promise<void> {
  const campaign = await prisma.pushbotCampaign.findFirst({ where: { shiftId, status: "RUNNING" } });
  if (!campaign) return;
  const shift = await prisma.shift.findUnique({ where: { id: shiftId }, select: { staffId: true } });
  if (shift?.staffId) await finish(campaign, "filled", shift.staffId);
}

export async function cancelCampaign(agencyId: string, campaignId: string, by: AuditActor): Promise<boolean> {
  const campaign = await prisma.pushbotCampaign.findFirst({ where: { id: campaignId, agencyId, status: "RUNNING" } });
  if (!campaign) return false;
  await finish(campaign, "cancelled");
  await recordAudit(by, { action: "pushbots.cancel", summary: "Stopped Pushbots filling a shift", targetType: "shift", targetId: campaign.shiftId });
  return true;
}

/**
 * Moves every running campaign on: ends those whose shift was filled or is
 * about to start, and sends the next wave where one is due.
 */
export async function tickCampaigns(now = new Date()): Promise<{ checked: number; waves: number; ended: number }> {
  const running = await prisma.pushbotCampaign.findMany({ where: { status: "RUNNING" }, include: { shift: { select: { staffId: true, status: true, startAt: true } } }, take: 200 });
  let waves = 0;
  let ended = 0;
  for (const c of running) {
    try {
      if (c.shift.staffId) {
        await finish(c, "filled", c.shift.staffId);
        ended++;
      } else if (c.shift.status === "CANCELLED" || c.shift.status === "COMPLETED") {
        await finish(c, "cancelled");
        ended++;
      } else if (c.shift.startAt.getTime() - now.getTime() < 30 * 60_000) {
        await finish(c, "expired");
        ended++;
      } else if (c.nextWaveAt && c.nextWaveAt <= now) {
        // Claim the wave, so two servers ticking at once don't both send it.
        const claimed = await prisma.pushbotCampaign.updateMany({ where: { id: c.id, nextWaveAt: c.nextWaveAt }, data: { nextWaveAt: null } });
        if (claimed.count === 1) {
          await runWave(c);
          waves++;
        }
      }
    } catch (error) {
      console.error(JSON.stringify({ event: "pushbots_tick_failed", campaignId: c.id, error: String(error) }));
    }
  }
  return { checked: running.length, waves, ended };
}

const LAST_TICK = "pushbots-last-tick";

/** Runs a tick at most once a minute, from whichever request gets there first. */
export async function maybeTickPushbots(now = new Date()): Promise<void> {
  try {
    const last = await prisma.serviceKey.findUnique({ where: { name: LAST_TICK } });
    if (last && now.getTime() - Number(last.value) < 60_000) return;
    if (last) {
      const claimed = await prisma.serviceKey.updateMany({ where: { name: LAST_TICK, value: last.value }, data: { value: String(now.getTime()) } });
      if (claimed.count === 0) return;
    } else {
      await prisma.serviceKey.create({ data: { name: LAST_TICK, value: String(now.getTime()) } }).catch(() => undefined);
    }
    await tickCampaigns(now);
  } catch (error) {
    console.error("pushbots tick failed", error);
  }
}

export const CAMPAIGN_HISTORY_DAYS = 30;
export const historySince = () => new Date(Date.now() - CAMPAIGN_HISTORY_DAYS * DAY);
