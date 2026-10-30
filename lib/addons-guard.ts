import { redirect } from "next/navigation";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";

/** Managers and admins, for an Element the agency has switched on. Returns the console installation. */
export async function requireInstalledAddon(key: "GATEWAY" | "PEAK") {
  const user = await requireOps();
  const row = await prisma.agencyAddon.findUnique({
    where: { agencyId_key: { agencyId: user.agencyId, key } },
    select: { installed: true, active: true, elementsInstallationId: true },
  });
  if (!row?.installed || !row.active || !row.elementsInstallationId) {
    redirect(user.role === "ADMIN" ? "/addons" : "/qualifiers");
  }
  return { user, installationId: row.elementsInstallationId };
}
