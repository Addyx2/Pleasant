"use server";

import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { installAddon, uninstallAddon, type AddonKey } from "@/lib/addons";
import { revalidatePath } from "next/cache";

export async function installAddonAction(formData: FormData) {
  const user = await requireAdmin();
  const key = formData.get("key") as AddonKey | null;
  if (key === "GATEWAY" || key === "PEAK") {
    await installAddon(user.agencyId, key);
    await recordAudit(user, { action: "addon.install", summary: `Installed ${key} add-on` });
  }
  revalidatePath("/addons");
}

export async function uninstallAddonAction(formData: FormData) {
  const user = await requireAdmin();
  const key = formData.get("key") as AddonKey | null;
  if (key === "GATEWAY" || key === "PEAK") {
    await uninstallAddon(user.agencyId, key);
    await recordAudit(user, { action: "addon.uninstall", summary: `Uninstalled ${key} add-on` });
  }
  revalidatePath("/addons");
}