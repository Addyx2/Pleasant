import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import type { Prisma } from "@prisma/client";

import type { SessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { ASSIST_TOOLS } from "./tools";
import { pendingActions, toTurns } from "./transcript";
import type { ChatTurn, ConversationSummary } from "./types";

// Conversations are private: every query is scoped to the signed-in user.

const WRITE_TOOLS = new Set(ASSIST_TOOLS.filter((t) => t.kind === "write").map((t) => t.name));
export const isWriteTool = (name: string) => WRITE_TOOLS.has(name);

export function ownedConversation(user: Pick<SessionUser, "id">, id: string) {
  return prisma.assistConversation.findFirst({ where: { id, userId: user.id } });
}

export async function listConversations(
  user: Pick<SessionUser, "id">,
  options: { query?: string; take?: number } = {},
): Promise<ConversationSummary[]> {
  const q = options.query?.trim();
  const rows = await prisma.assistConversation.findMany({
    where: { userId: user.id, ...(q ? { title: { contains: q, mode: "insensitive" } } : {}) },
    select: { id: true, title: true, pinned: true, updatedAt: true, automation: { select: { name: true } } },
    orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
    take: options.take ?? 100,
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    pinned: r.pinned,
    updatedAt: r.updatedAt.toISOString(),
    automation: r.automation?.name ?? null,
  }));
}

export interface ConversationView {
  id: string;
  title: string;
  pinned: boolean;
  automation: string | null;
  turns: ChatTurn[];
  hasPending: boolean;
}

export async function conversationView(user: Pick<SessionUser, "id">, id: string): Promise<ConversationView | null> {
  const row = await prisma.assistConversation.findFirst({
    where: { id, userId: user.id },
    include: { automation: { select: { name: true } } },
  });
  if (!row) return null;
  const turns = toTurns(
    row.messages as unknown as BetaMessageParam[],
    (row.summaries ?? {}) as Record<string, string>,
    isWriteTool,
  );
  return {
    id: row.id,
    title: row.title,
    pinned: row.pinned,
    automation: row.automation?.name ?? null,
    turns,
    hasPending: pendingActions(turns).length > 0,
  };
}

export function saveMessages(id: string, messages: BetaMessageParam[], summaries?: Record<string, string>) {
  return prisma.assistConversation.update({
    where: { id },
    data: {
      messages: messages as unknown as Prisma.InputJsonValue,
      ...(summaries ? { summaries: summaries as Prisma.InputJsonValue } : {}),
    },
  });
}
