"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { respondToOffer } from "@/lib/offers";

export async function respondToOfferAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (user.role !== "STAFF" || !staffId) redirect("/workforce");

  const outcome = await respondToOffer({
    agencyId: user.agencyId,
    staffId,
    offerId: String(formData.get("offerId") ?? ""),
    accept: formData.get("accept") === "1",
  });

  revalidatePath("/workforce");
  redirect(`/workforce?result=${outcome}`);
}
