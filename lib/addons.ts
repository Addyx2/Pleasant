import { prisma } from "./db";
import { revalidatePath } from "next/cache";

export type AddonKey = "GATEWAY" | "PEAK";

export type AddonDefinition = {
  key: AddonKey;
  name: string;
  shortDescription: string;
  accent: string;
  href: string;
  category: string;
};

export const ADDON_DEFINITIONS: AddonDefinition[] = [
  {
    key: "GATEWAY",
    name: "Gateway",
    shortDescription: "Always-on contact centre that answers every inbound call.",
    accent: "#4a9eff",
    href: "/addons/gateway",
    category: "contact-centre",
  },
  {
    key: "PEAK",
    name: "Peak",
    shortDescription: "Recognition that pays — points for shifts, punctuality and praise.",
    accent: "#00e676",
    href: "/addons/peak",
    category: "rewards",
  },
];

export async function getInstalledAddons(agencyId: string) {
  const rows = await prisma.agencyAddon.findMany({
    where: { agencyId, installed: true, active: true },
    select: { key: true },
  });
  const installed = new Set<AddonKey>(rows.map((r) => r.key as AddonKey));
  return ADDON_DEFINITIONS.filter((a) => installed.has(a.key));
}

export async function getAvailableAddons(agencyId: string) {
  const rows = await prisma.agencyAddon.findMany({
    where: { agencyId },
    select: { key: true, installed: true, active: true },
  });
  const map = new Map(rows.map((r) => [r.key, { installed: r.installed, active: r.active }]));
  return ADDON_DEFINITIONS.map((def) => {
    const m = map.get(def.key);
    return {
      ...def,
      installed: m?.installed ?? false,
      active: m?.active ?? true,
      purchased: m?.active ?? true,
    };
  });
}

export async function ensureAddonEntitlement(agencyId: string, key: AddonKey) {
  await prisma.agencyAddon.upsert({
    where: { agencyId_key: { agencyId, key } },
    create: { agencyId, key, installed: false, active: true },
    update: {},
  });
}

export async function installAddon(agencyId: string, key: AddonKey) {
  await ensureAddonEntitlement(agencyId, key);
  await prisma.agencyAddon.update({
    where: { agencyId_key: { agencyId, key } },
    data: { installed: true, installedAt: new Date() },
  });
  revalidatePath("/addons");
}

export async function uninstallAddon(agencyId: string, key: AddonKey) {
  await ensureAddonEntitlement(agencyId, key);
  await prisma.agencyAddon.update({
    where: { agencyId_key: { agencyId, key } },
    data: { installed: false, installedAt: null },
  });
  revalidatePath("/addons");
}

export async function toggleAddon(agencyId: string, key: AddonKey, installed: boolean) {
  if (installed) {
    await installAddon(agencyId, key);
  } else {
    await uninstallAddon(agencyId, key);
  }
}