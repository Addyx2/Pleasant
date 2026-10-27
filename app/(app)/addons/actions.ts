"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { installAddon, uninstallAddon } from "@/lib/addons";
import { syncGatewayDirectory } from "@/lib/elements-sync";

const NAMES = { GATEWAY: "Gateway", PEAK: "Peak" } as const;

function keyOf(formData: FormData) {
  const key = formData.get("key");
  return key === "GATEWAY" || key === "PEAK" ? key : null;
}

export async function installAddonAction(formData: FormData) {
  const user = await requireAdmin();
  const key = keyOf(formData);
  if (!key) return;
  const problem = await installAddon(user.agency, key);
  if (problem) redirect(`/addons?error=${encodeURIComponent(problem)}`);
  await recordAudit(user, { action: "addon.install", summary: `Switched on ${NAMES[key]}` });
  // Gateway needs everyone's phone numbers to recognise callers.
  if (key === "GATEWAY") after(() => syncGatewayDirectory(user.agencyId).catch((e) => console.error("gateway sync failed", e)));
  redirect(`/addons?on=${key}`);
}

export async function uninstallAddonAction(formData: FormData) {
  const user = await requireAdmin();
  const key = keyOf(formData);
  if (!key) return;
  const problem = await uninstallAddon(user.agencyId, key);
  if (problem) redirect(`/addons?error=${encodeURIComponent(problem)}`);
  await recordAudit(user, { action: "addon.uninstall", summary: `Switched off ${NAMES[key]}` });
  redirect("/addons");
}
