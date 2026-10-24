import type {
  BetaContentBlockParam,
  BetaMessageParam,
  BetaToolResultBlockParam,
  BetaToolUseBlockParam,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { toolLabel } from "./labels";
import type { ChatAction, ChatTurn } from "./types";

const blocks = (m: BetaMessageParam): BetaContentBlockParam[] =>
  typeof m.content === "string" ? [{ type: "text", text: m.content }] : (m.content as BetaContentBlockParam[]);

function resultText(r: BetaToolResultBlockParam): string {
  if (typeof r.content === "string") return r.content;
  return (r.content ?? []).map((c) => (c.type === "text" ? c.text : "")).join("");
}

/**
 * Rebuild the chat as the user saw it from the stored Messages API history:
 * one assistant turn per user message, carrying its text, the tools it used
 * and every change it asked to make (with the user's decision, if any).
 */
export function toTurns(
  messages: BetaMessageParam[],
  summaries: Record<string, string>,
  isWriteTool: (name: string) => boolean,
): ChatTurn[] {
  const results = new Map<string, BetaToolResultBlockParam>();
  for (const m of messages) {
    if (m.role !== "user") continue;
    for (const b of blocks(m)) if (b.type === "tool_result") results.set(b.tool_use_id, b);
  }

  const turns: ChatTurn[] = [];
  let current: Extract<ChatTurn, { role: "assistant" }> | null = null;

  for (const m of messages) {
    if (m.role === "user") {
      const text = blocks(m)
        .filter((b) => b.type === "text")
        .map((b) => (b as { text: string }).text)
        .join("\n")
        .trim();
      if (text) {
        turns.push({ role: "user", text });
        current = null;
      }
      continue;
    }
    if (!current) {
      current = { role: "assistant", text: "", activity: [], actions: [] };
      turns.push(current);
    }
    for (const b of blocks(m)) {
      if (b.type === "text" && b.text.trim()) {
        current.text = current.text ? `${current.text}\n\n${b.text}` : b.text;
      } else if (b.type === "tool_use") {
        const use = b as BetaToolUseBlockParam;
        if (isWriteTool(use.name)) {
          const result = results.get(use.id);
          const action: ChatAction = { id: use.id, tool: use.name, summary: summaries[use.id] ?? use.name };
          if (result) {
            const text = resultText(result);
            action.decision = /declined this action/.test(text) ? "decline" : "approve";
            action.failed = action.decision === "approve" && (result.is_error === true || /"ok":false/.test(text));
          }
          current.actions.push(action);
        } else {
          const label = toolLabel(use.name);
          if (!current.activity.includes(label)) current.activity.push(label);
        }
      }
    }
  }
  return turns;
}

/** Write actions in the last assistant message still waiting for the user. */
export function pendingActions(turns: ChatTurn[]): ChatAction[] {
  const last = turns.at(-1);
  return last?.role === "assistant" ? last.actions.filter((a) => !a.decision) : [];
}

/** A short title from the first message. */
export function titleFrom(text: string): string {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > 60 ? `${clean.slice(0, 57).trimEnd()}…` : clean || "New conversation";
}
