import type { Integration, Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

import { seal, unseal } from "./crypto";

export async function getIntegration(agencyId: string, provider: string): Promise<Integration | null> {
  return prisma.integration.findUnique({ where: { agencyId_provider: { agencyId, provider } } });
}

export function secretsOf<T>(integration: Pick<Integration, "secrets"> | null): T | null {
  return integration ? unseal<T>(integration.secrets) : null;
}

export function configOf<T extends object>(integration: Pick<Integration, "config"> | null): Partial<T> {
  return (integration?.config ?? {}) as Partial<T>;
}

export async function saveIntegration(input: {
  agencyId: string;
  provider: string;
  config: Record<string, unknown>;
  secrets: unknown;
  connectedById?: string;
}): Promise<Integration> {
  const data = {
    status: "CONNECTED" as const,
    config: input.config as Prisma.InputJsonValue,
    secrets: seal(input.secrets),
    connectedById: input.connectedById,
    lastError: null,
  };
  return prisma.integration.upsert({
    where: { agencyId_provider: { agencyId: input.agencyId, provider: input.provider } },
    create: { agencyId: input.agencyId, provider: input.provider, ...data },
    update: data,
  });
}

/** Replaces stored credentials, e.g. after an OAuth token refresh. */
export async function updateSecrets(id: string, secrets: unknown): Promise<void> {
  await prisma.integration.update({ where: { id }, data: { secrets: seal(secrets) } });
}

/**
 * Records a call's outcome in the integration's log. Unless `health` is false
 * (e.g. one text to a wrong number), it also sets the integration's status.
 */
export async function logIntegration(
  integration: Pick<Integration, "id" | "agencyId" | "provider">,
  action: string,
  ok: boolean,
  detail: string,
  options: { sync?: boolean; health?: boolean } = {},
): Promise<void> {
  const log = prisma.integrationLog.create({
    data: { integrationId: integration.id, agencyId: integration.agencyId, provider: integration.provider, action, ok, detail: detail.slice(0, 500) },
  });
  if (options.health === false) {
    await log;
    return;
  }
  await prisma.$transaction([
    log,
    prisma.integration.update({
      where: { id: integration.id },
      data: ok
        ? { status: "CONNECTED", lastError: null, ...(options.sync ? { lastSyncAt: new Date() } : {}) }
        : { status: "ERROR", lastError: detail.slice(0, 500) },
    }),
  ]);
}
