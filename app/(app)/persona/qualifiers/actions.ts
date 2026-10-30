"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { recordAudit } from "@/lib/audit";
import { requireOps } from "@/lib/auth";
import { qualifiers } from "@/lib/qualifiers";
import { writeSummary } from "@/lib/qualifiers/summary";

export async function writeSummaryAction(): Promise<void> {
  const user = await requireOps();
  const result = await writeSummary(user.agencyId, user, await qualifiers(user.agencyId)).catch((error) => {
    console.error("qualifiers summary failed", error);
    return { ok: false as const, error: "The summary couldn't be written. Try again." };
  });
  if (result.ok) await recordAudit(user, { action: "qualifiers.summary", summary: "Wrote the Qualifiers summary with AI" });
  revalidatePath("/persona/qualifiers");
  revalidatePath("/qualifiers");
  redirect(`/persona/qualifiers${result.ok ? "" : `?error=${encodeURIComponent(result.error)}`}`);
}
