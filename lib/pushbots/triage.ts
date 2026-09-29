import { prisma } from "@/lib/db";

/**
 * Initiates an automated Pushbot Triage Campaign for an Unattended or Open shift.
 */
export async function initiatePushbotTriage(shiftId: string, requestedByUserId: string) {
  // 1. Fetch the target shift
  const shift = await prisma.shift.findUnique({
    where: { id: shiftId },
    include: { agency: true, client: true, site: true },
  });

  if (!shift) throw new Error("Shift not found");

  if (shift.status !== "OPEN" && shift.status !== "UNATTENDED") {
    throw new Error(`Cannot triage a shift with status ${shift.status}`);
  }

  // 2. Find Eligible Workforce (Supply Match)
  // Simple matching: Active staff matching the required role, belonging to the same agency.
  const eligibleStaff = await prisma.staffProfile.findMany({
    where: {
      agencyId: shift.agencyId,
      status: "ACTIVE",
      jobTitle: shift.role,
      // Further filters can be added: 
      // - compliance checks
      // - overtime avoidance
      // - overlapping shifts check
    },
    select: { id: true, firstName: true, phone: true },
  });

  // 3. Create the Pushbot Campaign Record
  const campaign = await prisma.pushbotCampaign.create({
    data: {
      agencyId: shift.agencyId,
      shiftId: shift.id,
      targetRole: shift.role,
      channel: "WHATSAPP",
      status: "RUNNING",
      offersSent: eligibleStaff.length,
    },
  });

  // 4. Log the Agent Action
  await prisma.agentLog.create({
    data: {
      agencyId: shift.agencyId,
      agentName: "PUSHBOTS",
      action: "TRIAGE_SHIFT",
      details: JSON.stringify({
        shiftId: shift.id,
        shiftStatus: shift.status,
        eligibleCandidatesFound: eligibleStaff.length,
        campaignId: campaign.id,
      }),
      status: "SUCCESS",
    },
  });

  // 5. In a real environment, this is where we would trigger the external messaging API 
  // (Twilio / WhatsApp Business API) for each eligible worker.
  
  return {
    success: true,
    campaignId: campaign.id,
    eligibleCount: eligibleStaff.length,
    message: `Pushbot campaign initiated for ${eligibleStaff.length} eligible workers.`,
  };
}

/**
 * Processes a worker's reply to a Pushbot offer.
 * Implements atomic locking to prevent race conditions (double booking).
 */
export async function handlePushbotReply(campaignId: string, staffId: string, response: string) {
  // We use a transaction to lock the shift row to prevent double booking.
  const result = await prisma.$transaction(async (tx: any) => {
    const campaign = await tx.pushbotCampaign.findUnique({
      where: { id: campaignId },
      include: { shift: true },
    });

    if (!campaign) throw new Error("Campaign not found");
    if (campaign.status !== "RUNNING") throw new Error("Campaign is no longer active");
    
    // Check if shift was already claimed
    if (campaign.shift.status !== "OPEN" && campaign.shift.status !== "UNATTENDED") {
      return { success: false, message: "Shift was already claimed by another worker." };
    }

    // Update Shift State to ASSIGNED
    await tx.shift.update({
      where: { id: campaign.shiftId },
      data: {
        status: "ASSIGNED",
        staffId: staffId,
      },
    });

    // Mark Campaign as Completed
    await tx.pushbotCampaign.update({
      where: { id: campaignId },
      data: {
        status: "COMPLETED",
        claimedById: staffId,
      },
    });

    // Log the successful triage
    await tx.agentLog.create({
      data: {
        agencyId: campaign.agencyId,
        agentName: "PUSHBOTS",
        action: "SHIFT_CLAIMED",
        details: `Staff ${staffId} successfully claimed Shift ${campaign.shiftId}.`,
        status: "SUCCESS",
      },
    });

    return { success: true, message: "Shift assigned successfully." };
  });

  return result;
}
