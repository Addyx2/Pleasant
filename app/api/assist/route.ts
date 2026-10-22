import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessageParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

import { MAX_HISTORY, runAssist } from "@/lib/assist/agent";
import { isWriteTool, ownedConversation, saveMessages } from "@/lib/assist/store";
import { titleFrom } from "@/lib/assist/transcript";
import type { StreamEvent } from "@/lib/assist/types";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isOpsRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// Several model calls and tool runs can happen in one request. 60s is
// accepted on every Vercel plan; raise it if your plan allows longer.
export const maxDuration = 60;

// The browser sends only the next message or its decisions on pending
// changes. The history itself lives on the server, scoped to its owner.
const bodySchema = z
  .object({
    conversationId: z.string().min(1).max(64).optional(),
    message: z.string().trim().min(1).max(4000).optional(),
    decisions: z.record(z.enum(["approve", "decline"])).optional(),
  })
  .refine((b) => !!b.message !== !!b.decisions, "Send a message or decisions, not both");

function friendlyError(error: unknown): string {
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return "Assist isn't set up yet: an administrator needs to add an Anthropic API key (ANTHROPIC_API_KEY).";
  }
  if (error instanceof Anthropic.RateLimitError || error instanceof Anthropic.InternalServerError) {
    return "Assist is busy right now. Please try again in a moment.";
  }
  if (error instanceof Anthropic.BadRequestError) {
    return "Assist couldn't process this conversation. Start a new one and try again.";
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return "Assist couldn't reach the AI service. Check the connection and try again.";
  }
  if (error instanceof Error && /api key|apiKey|credentials/i.test(error.message)) {
    return "Assist isn't set up yet: an administrator needs to add an Anthropic API key (ANTHROPIC_API_KEY).";
  }
  return "Something went wrong in Assist. Please try again.";
}

/** Write tool calls in the last assistant message that haven't been answered. */
function pendingWriteIds(messages: BetaMessageParam[]): string[] {
  const last = messages.at(-1);
  if (!last || last.role !== "assistant" || typeof last.content === "string") return [];
  return (last.content as BetaContentBlockParam[])
    .filter((b) => b.type === "tool_use" && isWriteTool(b.name))
    .map((b) => (b as { id: string }).id);
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isOpsRole(user.role)) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  // JSON only: a cross-site HTML form can't send this content type.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Expected JSON" }, { status: 415 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const { conversationId, message, decisions } = parsed.data;

  let conversation = conversationId ? await ownedConversation(user, conversationId) : null;
  if (conversationId && !conversation) {
    return Response.json({ error: "Conversation not found" }, { status: 404 });
  }
  const history = (conversation?.messages ?? []) as unknown as BetaMessageParam[];
  const pending = pendingWriteIds(history);

  if (message && pending.length > 0) {
    return Response.json({ error: "Approve or decline the pending change first." }, { status: 409 });
  }
  if (decisions && (pending.length === 0 || !pending.every((id) => decisions[id]))) {
    return Response.json({ error: "There's nothing waiting for those decisions." }, { status: 409 });
  }
  if (history.length >= MAX_HISTORY) {
    return Response.json({ error: "This conversation is too long. Start a new one." }, { status: 413 });
  }

  if (!conversation) {
    conversation = await prisma.assistConversation.create({
      data: { agencyId: user.agencyId, userId: user.id, title: titleFrom(message!) },
    });
  }
  const id = conversation.id;
  const messages: BetaMessageParam[] = message ? [...history, { role: "user", content: message }] : history;
  const summaries = { ...((conversation.summaries ?? {}) as Record<string, string>) };
  if (message) await saveMessages(id, messages);

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      send({ type: "conversation", id, title: conversation!.title });
      try {
        const events = runAssist(user, messages, decisions ?? {}, {
          scope: { disabled: user.agency.assistDisabled },
        });
        for await (const event of events) {
          if (event.type === "state") {
            // Checkpoint the history on the server; the browser never holds it.
            await saveMessages(id, event.messages, summaries);
            continue;
          }
          if (event.type === "confirm") {
            for (const a of event.actions) summaries[a.id] = a.summary;
            await prisma.assistConversation.update({ where: { id }, data: { summaries } });
          }
          send(event);
          if (request.signal.aborted) break;
        }
      } catch (error) {
        console.error("assist failed", error);
        send({ type: "error", message: friendlyError(error) });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
