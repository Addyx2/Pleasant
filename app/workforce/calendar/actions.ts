"use server";

import { revalidatePath } from "next/cache";

import { requireUser } from "@/lib/auth";
import { addUnavailability, removeUnavailability } from "@/lib/carer/work";

export interface AvailabilityState {
  ok?: string;
  error?: string;
}

/** A carer says when they can't work. Their agency then can't book or offer them shifts then. */
export async function addUnavailabilityAction(_prev: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (user.role !== "STAFF" || !staffId) return { error: "Only carers can set their availability." };
  const result = await addUnavailability(user.agencyId, staffId, Object.fromEntries(formData));
  if (!result.ok) return { error: result.error };
  revalidatePath("/workforce/calendar");
  return { ok: result.message };
}

export async function removeUnavailabilityAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (!staffId) return;
  await removeUnavailability(user.agencyId, staffId, String(formData.get("id") ?? ""));
  revalidatePath("/workforce/calendar");
}
