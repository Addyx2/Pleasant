// Shapes shared by the Assist server routes and the chat UI (client-safe).

export type Decision = "approve" | "decline";

export interface ChatAction {
  id: string;
  tool: string;
  summary: string;
  decision?: Decision;
  /** Set once an approved action has run and reported failure. */
  failed?: boolean;
}

export type ChatTurn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; activity: string[]; actions: ChatAction[]; error?: string };

export interface ConversationSummary {
  id: string;
  title: string;
  pinned: boolean;
  updatedAt: string;
  automation: string | null;
}

export type StreamEvent =
  | { type: "conversation"; id: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "navigate"; path: string }
  | { type: "confirm"; actions: { id: string; tool: string; summary: string }[] }
  | { type: "error"; message: string }
  | { type: "done" };
