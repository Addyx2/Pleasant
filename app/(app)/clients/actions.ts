"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generatePleasantLink } from "@/lib/clientpoint/pleasant-link";
import { createClientSchema, createSiteSchema } from "@/lib/validation";
import type { ActionState } from "@/app/(app)/shifts/actions";

export async function createClientAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const parsed = createClientSchema.safeParse({
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
    phone: formData.get("phone"),
    email: formData.get("email"),
    companyName: formData.get("companyName"),
    vatNumber: formData.get("vatNumber"),
    careLevel: formData.get("careLevel"),
    notes: formData.get("notes"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save this client" };
  }

  const data = parsed.data;
  await prisma.client.create({
    data: {
      agencyId: user.agencyId,
      firstName: data.firstName,
      lastName: data.lastName,
      address: data.address ?? null,
      postcode: data.postcode ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      companyName: data.companyName ?? null,
      vatNumber: data.vatNumber ?? null,
      careLevel: data.careLevel ?? null,
      notes: data.notes ?? null,
      status: "ACTIVE",
    },
  });

  revalidatePath("/clients");
  revalidatePath("/dashboard");
  return { success: "Client added" };
}

export async function createSiteAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const user = await requireAdmin();

  const parsed = createSiteSchema.safeParse({
    name: formData.get("name"),
    address: formData.get("address"),
    postcode: formData.get("postcode"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Could not save this site" };
  }

  const data = parsed.data;
  await prisma.site.create({
    data: {
      agencyId: user.agencyId,
      name: data.name,
      address: data.address ?? null,
      postcode: data.postcode ?? null,
    },
  });

  revalidatePath("/clients");
  return { success: "Site added" };
}

export async function createPleasantLinkAction(clientId: string): Promise<ActionState & { link?: string }> {
  const user = await requireAdmin();

  const client = await prisma.client.findFirst({
    where: { id: clientId, agencyId: user.agencyId },
  });
  if (!client) return { error: "Client not found" };

  const token = await generatePleasantLink(user.agencyId, client.id);

  return {
    success: "Link created — valid for 24 hours",
    link: `/pleasant-link/${token.token}`,
  };
}
