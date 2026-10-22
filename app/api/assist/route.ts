import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";

import { MAX_HISTORY, runAssist, type AssistEvent } from "@/lib/assist/agent";
import { getSessionUser } from "@/lib/auth";
import { isOpsRole } from "@/lib/permissions";

export const dynamic = "force-dynamic";
// Several model calls and tool runs can happen in one request.
export const maxDuration = 300;

const MAX_BODY_BYTES = 2_000_000;

// The conversation lives in the browser and is sent back verbatim each turn
// (assistant turns must be replayed unchanged). Only its outline is checked
// here: every tool still enforces the user's own permissions server-side.
const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.union([z.string().max(20_000), z.array(z.record(z.unknown())).max(100)]),
      }),
    )
    .min(1)
    .max(MAX_HISTORY),
  decisions: z.record(z.enum(["approve", "decline"])).optional(),
});

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

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || !isOpsRole(user.role)) {
    return Response.json({ error: "Not signed in" }, { status: 401 });
  }
  // JSON only: a cross-site HTML form can't send this content type.
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "Expected JSON" }, { status: 415 });
  }
  if (Number(request.headers.get("content-length") ?? 0) > MAX_BODY_BYTES) {
    return Response.json({ error: "This conversation is too long. Start a new one." }, { status: 413 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
  const messages = parsed.data.messages as BetaMessageParam[];
  const last = messages.at(-1)!;
  const resuming = last.role === "assistant";
  if (resuming && !parsed.data.decisions) {
    return Response.json({ error: "Missing decisions" }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AssistEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of runAssist(user, messages, parsed.data.decisions ?? {})) {
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
