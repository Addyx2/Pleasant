"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { requestShift } from "@/lib/carer/work";

export async function requestShiftAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (user.role !== "STAFF" || !staffId) redirect("/workforce");

  // Keep the carer's filter after they ask for a shift.
  const show = /^[a-z]{1,12}$/.test(String(formData.get("show") ?? "")) ? `&show=${formData.get("show")}` : "";
  const outcome = await requestShift(user.agencyId, staffId, String(formData.get("shiftId") ?? ""), String(formData.get("message") ?? ""));

  revalidatePath("/workforce/open-shifts");
  redirect(`/workforce/open-shifts?result=${outcome}${show}`);
}
