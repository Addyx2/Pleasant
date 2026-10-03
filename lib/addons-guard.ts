"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ensureAddonEntitlement } from "@/lib/addons";

export async function requireInstalledAddon(key: "GATEWAY" | "PEAK") {
  const user = await requireUser();
  await ensureAddonEntitlement(user.agencyId, key);
  const { prisma } = await import("@/lib/db");
  const row = await prisma.agencyAddon.findUnique({
    where: { agencyId_key: { agencyId: user.agencyId, key } },
    select: { installed: true, active: true },
  });
  if (!row?.installed || !row?.active) {
    redirect("/addons");
  }
  return user;
}