import { headers } from "next/headers";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/db";

export interface AuditActor {
  id: string;
  email: string;
  agencyId: string;
}

export interface AuditInput {
  action: string;
  summary: string;
  targetType?: string;
  targetId?: string;
  metadata?: Prisma.InputJsonValue;
}

export async function clientIp(): Promise<string | null> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
    return h.get("x-real-ip");
  } catch {
    return null;
  }
}

/**
 * Append an entry to the agency's audit trail. Auditing must never break the
 * action being audited, so failures are logged and swallowed.
 */
export async function recordAudit(actor: AuditActor, input: AuditInput): Promise<void> {
  try {
    await prisma.auditEvent.create({
      data: {
        agencyId: actor.agencyId,
        actorId: actor.id,
        actorEmail: actor.email,
        action: input.action,
        summary: input.summary,
        targetType: input.targetType,
        targetId: input.targetId,
        metadata: input.metadata,
        ip: await clientIp(),
      },
    });
  } catch (error) {
    console.error("audit: failed to record", input.action, error);
  }
}
