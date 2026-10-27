"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOps, type SessionUser } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { generatePleasantLink } from "@/lib/clientpoint/pleasant-link";
import { clientContactSchema, clientRateSchema, clientSchema, createSiteSchema } from "@/lib/validation";
import type { ActionState } from "@/app/(app)/shifts/actions";
import { after } from "next/server";
import { sendElementEvent } from "@/lib/elements";
import { contactPerson } from "@/lib/elements-sync";

function clientFields(formData: FormData) {
  return clientSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") ?? "CARE_HOME",
    address: formData.get("address") ?? "",
    postcode: formData.get("postcode") ?? "",
    phone: formData.get("phone") ?? "",
    email: formData.get("email") ?? "",
    vatNumber: formData.get("vatNumber") ?? "",
    companyNo: formData.get("companyNo") ?? "",
    cqcLocationId: formData.get("cqcLocationId") ?? "",
    frameworkRef: formData.get("frameworkRef") ?? "",
    paymentTermsDays: formData.get("paymentTermsDays") || 30,
    status: formData.get("status") || "ACTIVE",
    notes: formData.get("notes") ?? "",
  });
}

async function ownClient(user: SessionUser, clientId: string) {
  return prisma.client.findFirst({ where: { id: clientId, agencyId: user.agencyId } });
}

function refreshClient(clientId: string) {
  revalidatePath("/clients");
  revalidatePath(`/clients/${clientId}`);
}

export async function createClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOps();
  const parsed = clientFields(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save this client" };

  const d = parsed.data;
  const client = await prisma.client.create({
    data: {
      agencyId: user.agencyId,
      name: d.name,
      type: d.type,
      address: d.address ?? null,
      postcode: d.postcode ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      vatNumber: d.vatNumber ?? null,
      companyNo: d.companyNo ?? null,
      cqcLocationId: d.cqcLocationId ?? null,
      frameworkRef: d.frameworkRef ?? null,
      paymentTermsDays: d.paymentTermsDays,
      notes: d.notes ?? null,
      status: "ACTIVE",
    },
  });
  await recordAudit(user, {
    action: "client.create",
    summary: `Added client ${d.name}`,
    targetType: "Client",
    targetId: client.id,
  });

  revalidatePath("/clients");
  redirect(`/clients/${client.id}`);
}

export async function updateClientAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOps();
  const client = await ownClient(user, String(formData.get("clientId") ?? ""));
  if (!client) return { error: "Client not found" };
  const parsed = clientFields(formData);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save this client" };

  const d = parsed.data;
  await prisma.client.update({
    where: { id: client.id },
    data: {
      name: d.name,
      type: d.type,
      address: d.address ?? null,
      postcode: d.postcode ?? null,
      phone: d.phone ?? null,
      email: d.email ?? null,
      vatNumber: d.vatNumber ?? null,
      companyNo: d.companyNo ?? null,
      cqcLocationId: d.cqcLocationId ?? null,
      frameworkRef: d.frameworkRef ?? null,
      paymentTermsDays: d.paymentTermsDays,
      status: d.status,
      notes: d.notes ?? null,
    },
  });
  await recordAudit(user, {
    action: "client.update",
    summary: `Updated details for ${d.name}`,
    targetType: "Client",
    targetId: client.id,
  });

  refreshClient(client.id);
  return { success: "Saved" };
}

export async function createSiteAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOps();
  const parsed = createSiteSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    address: formData.get("address") ?? "",
    postcode: formData.get("postcode") ?? "",
    notes: formData.get("notes") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save this site" };

  const d = parsed.data;
  const client = await ownClient(user, d.clientId);
  if (!client) return { error: "Client not found" };

  await prisma.site.create({
    data: {
      agencyId: user.agencyId,
      clientId: client.id,
      name: d.name,
      address: d.address ?? client.address ?? null,
      postcode: d.postcode ?? client.postcode ?? null,
      notes: d.notes ?? null,
    },
  });

  refreshClient(client.id);
  return { success: `${d.name} added` };
}

export async function deleteSiteAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const siteId = String(formData.get("siteId") ?? "");
  const site = await prisma.site.findFirst({ where: { id: siteId, agencyId: user.agencyId } });
  if (!site) return;
  // Shifts keep their history: Shift.siteId is SetNull on delete.
  await prisma.site.delete({ where: { id: site.id } });
  if (site.clientId) refreshClient(site.clientId);
}

export async function createContactAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOps();
  const parsed = clientContactSchema.safeParse({
    clientId: formData.get("clientId"),
    name: formData.get("name"),
    jobTitle: formData.get("jobTitle") ?? "",
    email: formData.get("email") ?? "",
    phone: formData.get("phone") ?? "",
    isSignatory: formData.get("isSignatory") === "on",
    isAccounts: formData.get("isAccounts") === "on",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save this contact" };

  const d = parsed.data;
  const client = await ownClient(user, d.clientId);
  if (!client) return { error: "Client not found" };

  const contact = await prisma.clientContact.create({
    data: {
      agencyId: user.agencyId,
      clientId: client.id,
      name: d.name,
      jobTitle: d.jobTitle ?? null,
      email: d.email ?? null,
      phone: d.phone ?? null,
      isSignatory: d.isSignatory,
      isAccounts: d.isAccounts,
    },
  });
  if (contact.phone) {
    after(() => sendElementEvent(user.agencyId, "GATEWAY", "platform.person.updated", contactPerson(contact, client.name)));
  }
  if (d.isSignatory) {
    await recordAudit(user, {
      action: "client.signatory_add",
      summary: `Added ${d.name} as a timesheet signatory for ${client.name}`,
      targetType: "ClientContact",
      targetId: contact.id,
    });
  }

  refreshClient(client.id);
  return { success: `${d.name} added` };
}

export async function updateContactRolesAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const contact = await prisma.clientContact.findFirst({
    where: { id: String(formData.get("contactId") ?? ""), agencyId: user.agencyId },
    include: { client: true },
  });
  if (!contact) return;
  const field = formData.get("field");
  if (field !== "isSignatory" && field !== "isAccounts") return;
  const value = formData.get("value") === "true";

  await prisma.clientContact.update({ where: { id: contact.id }, data: { [field]: value } });
  if (field === "isSignatory") {
    await recordAudit(user, {
      action: value ? "client.signatory_add" : "client.signatory_remove",
      summary: `${value ? "Made" : "Removed"} ${contact.name} ${value ? "a" : "as"} timesheet signatory for ${contact.client.name}`,
      targetType: "ClientContact",
      targetId: contact.id,
    });
  }
  refreshClient(contact.clientId);
}

export async function deleteContactAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const contact = await prisma.clientContact.findFirst({
    where: { id: String(formData.get("contactId") ?? ""), agencyId: user.agencyId },
  });
  if (!contact) return;
  // Outstanding Pleasant Links issued to this contact stop working.
  await prisma.$transaction([
    prisma.pleasantLinkToken.updateMany({
      where: { contactId: contact.id, expiresAt: { gt: new Date() } },
      data: { expiresAt: new Date() },
    }),
    prisma.clientContact.delete({ where: { id: contact.id } }),
  ]);
  after(() => sendElementEvent(user.agencyId, "GATEWAY", "platform.person.removed", { personId: `contact:${contact.id}` }));
  await recordAudit(user, {
    action: "client.contact_remove",
    summary: `Removed contact ${contact.name}`,
    targetType: "Client",
    targetId: contact.clientId,
  });
  refreshClient(contact.clientId);
}

export async function saveRateAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireOps();
  const parsed = clientRateSchema.safeParse({
    clientId: formData.get("clientId"),
    siteId: formData.get("siteId") ?? "",
    role: formData.get("role"),
    dayRate: formData.get("dayRate"),
    nightRate: formData.get("nightRate") ?? "",
    weekendRate: formData.get("weekendRate") ?? "",
    bankHolidayRate: formData.get("bankHolidayRate") ?? "",
    sleepInCharge: formData.get("sleepInCharge") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Could not save this rate" };

  const d = parsed.data;
  const client = await ownClient(user, d.clientId);
  if (!client) return { error: "Client not found" };
  if (d.siteId) {
    const site = await prisma.site.findFirst({ where: { id: d.siteId, clientId: client.id } });
    if (!site) return { error: "Choose one of this client's sites" };
  }

  const values = {
    dayRate: d.dayRate,
    nightRate: d.nightRate ?? null,
    weekendRate: d.weekendRate ?? null,
    bankHolidayRate: d.bankHolidayRate ?? null,
    sleepInCharge: d.sleepInCharge ?? null,
  };
  // One line per role and site: saving the same pair again updates it.
  const existing = await prisma.clientRate.findFirst({
    where: { clientId: client.id, siteId: d.siteId ?? null, role: { equals: d.role, mode: "insensitive" } },
  });
  const rate = existing
    ? await prisma.clientRate.update({ where: { id: existing.id }, data: values })
    : await prisma.clientRate.create({
        data: { agencyId: user.agencyId, clientId: client.id, siteId: d.siteId ?? null, role: d.role, ...values },
      });

  await recordAudit(user, {
    action: "client.rate",
    summary: `${existing ? "Updated" : "Set"} ${d.role} charge rate for ${client.name}: £${d.dayRate.toFixed(2)}/hr day`,
    targetType: "ClientRate",
    targetId: rate.id,
    metadata: values,
  });

  refreshClient(client.id);
  return { success: `${d.role} rate saved` };
}

export async function deleteRateAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const rate = await prisma.clientRate.findFirst({
    where: { id: String(formData.get("rateId") ?? ""), agencyId: user.agencyId },
    include: { client: true },
  });
  if (!rate) return;
  await prisma.clientRate.delete({ where: { id: rate.id } });
  await recordAudit(user, {
    action: "client.rate",
    summary: `Removed ${rate.role} charge rate for ${rate.client.name}`,
    targetType: "Client",
    targetId: rate.clientId,
  });
  refreshClient(rate.clientId);
}

export async function createPleasantLinkAction(
  clientId: string,
  contactId: string,
): Promise<ActionState & { link?: string; contactName?: string }> {
  const user = await requireOps();

  const client = await ownClient(user, clientId);
  if (!client) return { error: "Client not found" };
  const contact = await prisma.clientContact.findFirst({
    where: { id: contactId, clientId: client.id, isSignatory: true },
  });
  if (!contact) return { error: "Choose a signatory — add one under Contacts first" };

  const token = await generatePleasantLink(user.agencyId, client.id, contact.id);
  await recordAudit(user, {
    action: "client.link_issue",
    summary: `Issued a Pleasant Link to ${contact.name} at ${client.name}`,
    targetType: "ClientContact",
    targetId: contact.id,
  });

  return {
    success: "Link created — valid for 24 hours",
    link: `/pleasant-link/${token.token}`,
    contactName: contact.name,
  };
}
