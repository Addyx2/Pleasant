"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOps } from "@/lib/auth";
import { unavailableReason } from "@/lib/availability";
import { prisma } from "@/lib/db";
import { getBankHolidays } from "@/lib/integrations/bank-holidays";
import { startCampaign } from "@/lib/pushbots/campaign";
import { clientName, resolveChargeRate, resolveSleepInCharge, toRateCardEntry } from "@/lib/clients";
import { createShiftSchema } from "@/lib/validation";

export interface ActionState {
  error?: string;
  success?: string;
}

export async function createShiftAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireOps();

  const parsed = createShiftSchema.safeParse({
    title: formData.get("title"),
    role: formData.get("role"),
    clientId: formData.get("clientId"),
    siteId: formData.get("siteId"),
    staffId: formData.get("staffId"),
    startAt: formData.get("startAt"),
    endAt: formData.get("endAt"),
    breakMins: formData.get("breakMins") || 0,
    chargeRate: formData.get("chargeRate") || undefined,
    isSleepIn: formData.get("isSleepIn") === "on",
    sleepInRate: formData.get("sleepInRate") || 0,
    sleepInCharge: formData.get("sleepInCharge") || undefined,
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not create the shift" };
  }

  const data = parsed.data;
  if (data.endAt <= data.startAt) {
    return { error: "The shift must end after it starts" };
  }

  // Every referenced record must belong to this agency, and the unit to the client.
  const [client, site, staff] = await Promise.all([
    data.clientId
      ? prisma.client.findFirst({ where: { id: data.clientId, agencyId: user.agencyId }, include: { rates: true } })
      : null,
    data.siteId ? prisma.site.findFirst({ where: { id: data.siteId, agencyId: user.agencyId } }) : null,
    data.staffId ? prisma.staffProfile.findFirst({ where: { id: data.staffId, agencyId: user.agencyId } }) : null,
  ]);
  if ((data.clientId && !client) || (data.siteId && !site) || (data.staffId && !staff)) {
    return { error: "Choose a client, unit and carer from your own agency" };
  }
  if (site && client && site.clientId && site.clientId !== client.id) {
    return { error: `${site.name} belongs to a different client` };
  }
  if (staff) {
    const unavailable = await unavailableReason(user.agencyId, staff.id, data.startAt, data.endAt);
    if (unavailable) return { error: `${unavailable} Leave the shift open, or choose someone else.` };
  }

  const rateCard = client?.rates.map(toRateCardEntry) ?? [];
  let chargeRate = data.chargeRate;
  if (chargeRate === undefined && !data.isSleepIn && client) {
    const resolved = resolveChargeRate(rateCard, {
      role: data.role,
      siteId: site?.id ?? null,
      startAt: data.startAt,
      endAt: data.endAt,
    }, await getBankHolidays(user.agency.bankHolidayDivision));
    if (!resolved) {
      return {
        error: `${clientName(client)} has no ${data.role} rate on its rate card. Enter a charge rate, or add the role to the rate card.`,
      };
    }
    chargeRate = resolved.rate;
  }
  // Sleep-ins: an explicit charge wins, then the rate card; null bills the allowance.
  const sleepInCharge = data.isSleepIn
    ? (data.sleepInCharge ?? resolveSleepInCharge(rateCard, { role: data.role, siteId: site?.id ?? null }))
    : null;
  const title =
    data.title ?? [data.isSleepIn ? `${data.role} sleep-in` : data.role, site?.name].filter(Boolean).join(" — ");

  await prisma.shift.create({
    data: {
      agencyId: user.agencyId,
      createdById: user.id,
      title,
      role: data.role,
      clientId: data.clientId ?? null,
      siteId: data.siteId ?? null,
      staffId: data.staffId ?? null,
      startAt: data.startAt,
      endAt: data.endAt,
      breakMins: data.breakMins,
      chargeRate: chargeRate ?? 0,
      isSleepIn: data.isSleepIn,
      sleepInRate: data.sleepInRate,
      sleepInCharge,
      notes: data.notes ?? null,
      status: data.staffId ? "ASSIGNED" : "OPEN",
    },
  });

  revalidatePath("/shifts");
  revalidatePath("/dashboard");
  return { success: "Shift created" };
}

export async function assignShiftFormAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const shiftId = String(formData.get("shiftId") ?? "");
  const staffId = String(formData.get("staffId") ?? "");

  if (!shiftId || !staffId) return;

  const [staff, shift] = await Promise.all([
    prisma.staffProfile.findFirst({ where: { id: staffId, agencyId: user.agencyId } }),
    prisma.shift.findFirst({ where: { id: shiftId, agencyId: user.agencyId }, select: { startAt: true, endAt: true } }),
  ]);
  if (!staff || !shift) return;
  // The conflict shield: never book a carer when they've said they can't work.
  const unavailable = await unavailableReason(user.agencyId, staff.id, shift.startAt, shift.endAt);
  if (unavailable) redirect(`/shifts/${shiftId}?unavailable=${encodeURIComponent(unavailable)}`);

  await prisma.shift.updateMany({
    where: { id: shiftId, agencyId: user.agencyId },
    data: { staffId, status: "ASSIGNED" },
  });

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/dashboard");
}

export async function updateShiftStatusAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const shiftId = String(formData.get("shiftId") ?? "");
  const status = String(formData.get("status") ?? "");

  const allowed = ["DRAFT", "OPEN", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED", "NO_SHOW", "UNATTENDED"];

  if (!shiftId || !allowed.includes(status)) return;

  const unassignStatuses = ["DRAFT", "OPEN", "UNATTENDED"];

  await prisma.shift.updateMany({
    where: { id: shiftId, agencyId: user.agencyId },
    data: unassignStatuses.includes(status) ? { status: status as never, staffId: null } : { status: status as never },
  });

  revalidatePath("/shifts");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/shifts/unattended");
  revalidatePath("/dashboard");
}

export async function triageShiftAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!shiftId || !user) return;

  const shift = await prisma.shift.findFirst({
    where: { id: shiftId, agencyId: user.agencyId },
  });
  if (!shift || (shift.status !== "OPEN" && shift.status !== "UNATTENDED")) return;

  await startCampaign(user.agencyId, shiftId, user.id);
  revalidatePath("/shifts/unattended");
  revalidatePath(`/shifts/${shiftId}`);
  revalidatePath("/dashboard");
}

export async function deleteShiftAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const shiftId = String(formData.get("shiftId") ?? "");
  if (!shiftId) return;

  await prisma.shift.deleteMany({
    where: { id: shiftId, agencyId: user.agencyId, status: { in: ["DRAFT", "OPEN", "CANCELLED"] } },
  });

  revalidatePath("/shifts");
  revalidatePath("/dashboard");
}
