"use server";

import { requireUser } from "@/lib/auth";
import { installAddon, uninstallAddon, type AddonKey } from "@/lib/addons";
import { revalidatePath } from "next/cache";

export async function installAddonAction(formData: FormData) {
  const user = await requireUser();
  const key = formData.get("key") as AddonKey | null;
  if (key === "GATEWAY" || key === "PEAK") {
    await installAddon(user.agencyId, key);
  }
  revalidatePath("/addons");
}

export async function uninstallAddonAction(formData: FormData) {
  const user = await requireUser();
  const key = formData.get("key") as AddonKey | null;
  if (key === "GATEWAY" || key === "PEAK") {
    await uninstallAddon(user.agencyId, key);
  }
  revalidatePath("/addons");
}