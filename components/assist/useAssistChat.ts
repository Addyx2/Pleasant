"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import type { ChatTurn, Decision, StreamEvent } from "@/lib/assist/types";

type AssistantTurn = Extract<ChatTurn, { role: "assistant" }>;

export interface AssistChat {
  conversationId: string | null;
  title: string | null;
  turns: ChatTurn[];
  busy: boolean;
  loading: boolean;
  pendingCount: number;
  send: (text: string) => void;
  decide: (actionId: string | "*", decision: Decision) => void;
  stop: () => void;
  reset: () => void;
  load: (id: string) => Promise<boolean>;
}

/**
 * One Assist conversation, shared by the floating panel and the full page.
 * The server owns the history; this hook sends the next message (or the
 * user's decisions), renders the stream, then re-syncs from the server.
 */
export function useAssistChat(options: {
  /** A conversation already loaded on the server, to open with. */
  initial?: { id: string; title: string; turns: ChatTurn[] } | null;
  onConversation?: (id: string, title: string) => void;
  onSettled?: () => void;
} = {}): AssistChat {
  const router = useRouter();
  const [conversationId, setConversationId] = useState<string | null>(options.initial?.id ?? null);
  const [title, setTitle] = useState<string | null>(options.initial?.title ?? null);
  const [turns, setTurns] = useState<ChatTurn[]>(options.initial?.turns ?? []);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const idRef = useRef<string | null>(options.initial?.id ?? null);
  const resumedRef = useRef(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const updateLast = useCallback((fn: (t: AssistantTurn) => ChatTurn) => {
    setTurns((prev) => {
      const next = [...prev];
      for (let i = next.length - 1; i >= 0; i--) {
        const t = next[i];
        if (t.role === "assistant") {
          next[i] = fn(t);
          break;
        }
      }
      return next;
    });
  }, []);

  const load = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/assist/conversations/${id}`, { cache: "no-store" });
      if (!res.ok) return false;
      const view = (await res.json()) as { id: string; title: string; turns: ChatTurn[] };
      idRef.current = view.id;
      setConversationId(view.id);
      setTitle(view.title);
      setTurns(view.turns);
      return true;
    } finally {
      setLoading(false);
    }
  }, []);

  const stream = useCallback(
    async (body: { message?: string; decisions?: Record<string, Decision> }) => {
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, conversationId: idRef.current ?? undefined }),
          signal: controller.signal,
        });
        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error ?? "Assist is unavailable right now.");
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const event = JSON.parse(line) as StreamEvent;
            switch (event.type) {
              case "conversation":
                if (idRef.current !== event.id) {
                  idRef.current = event.id;
                  setConversationId(event.id);
                  setTitle(event.title);
                  optionsRef.current.onConversation?.(event.id, event.title);
                }
                break;
              case "text":
                updateLast((t) => {
                  const gap = resumedRef.current && t.text ? "\n\n" : "";
                  resumedRef.current = false;
                  return { ...t, text: t.text + gap + event.delta };
                });
                break;
              case "tool":
                updateLast((t) => (t.activity.includes(event.label) ? t : { ...t, activity: [...t.activity, event.label] }));
                break;
              case "navigate":
                router.push(event.path);
                break;
              case "confirm":
                updateLast((t) => ({ ...t, actions: [...t.actions, ...event.actions] }));
                break;
              case "error":
                updateLast((t) => ({ ...t, error: event.message }));
                break;
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          updateLast((t) => ({ ...t, error: (error as Error).message || "Assist is unavailable right now." }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        router.refresh();
        // Re-sync with the saved conversation (keeps any error shown locally).
        const id = idRef.current;
        if (id) {
          const res = await fetch(`/api/assist/conversations/${id}`, { cache: "no-store" }).catch(() => null);
          if (res?.ok) {
            const view = (await res.json()) as { title: string; turns: ChatTurn[] };
            setTitle(view.title);
            setTurns((prev) => {
              const lastError = prev.at(-1)?.role === "assistant" ? (prev.at(-1) as AssistantTurn).error : undefined;
              const synced = [...view.turns];
              const tail = synced.at(-1);
              if (lastError && tail?.role === "assistant") synced[synced.length - 1] = { ...tail, error: lastError };
              else if (lastError) synced.push({ role: "assistant", text: "", activity: [], actions: [], error: lastError });
              return synced;
            });
          }
        }
        optionsRef.current.onSettled?.();
      }
    },
    [router, updateLast],
  );

  const send = useCallback(
    (text: string) => {
      const message = text.trim();
      if (!message || busy) return;
      setTurns((prev) => [
        ...prev,
        { role: "user", text: message },
        { role: "assistant", text: "", activity: [], actions: [] },
      ]);
      void stream({ message });
    },
    [busy, stream],
  );

  const decide = useCallback(
    (actionId: string | "*", decision: Decision) => {
      const last = turns.at(-1);
      if (last?.role !== "assistant" || busy) return;
      const actions = last.actions.map((a) =>
        !a.decision && (a.id === actionId || actionId === "*") ? { ...a, decision } : a,
      );
      setTurns([...turns.slice(0, -1), { ...last, actions, error: undefined }]);
      const open = actions.filter((a) => !a.decision);
      if (open.length > 0) return;
      resumedRef.current = true;
      // Decisions for actions already settled are ignored by the server.
      void stream({
        decisions: Object.fromEntries(actions.map((a) => [a.id, a.decision!])),
      });
    },
    [turns, busy, stream],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    idRef.current = null;
    setConversationId(null);
    setTitle(null);
    setTurns([]);
  }, []);

  const last = turns.at(-1);
  const pendingCount = last?.role === "assistant" ? last.actions.filter((a) => !a.decision).length : 0;

  return {
    conversationId,
    title,
    turns,
    busy,
    loading,
    pendingCount,
    send,
    decide,
    stop: () => abortRef.current?.abort(),
    reset,
    load,
  };
}
