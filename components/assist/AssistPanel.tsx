"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Check, Loader2, Plus, ShieldCheck, Sparkles, Square, X } from "lucide-react";
import type { BetaMessageParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";

import { cn } from "@/lib/utils";

import { AssistMarkdown } from "./AssistMarkdown";

export const OPEN_ASSIST_EVENT = "pleasant:open-assist";

/** Open Assist from anywhere, optionally sending a prompt straight away. */
export function openAssist(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_ASSIST_EVENT, { detail: { prompt } }));
}

type Decision = "approve" | "decline";

interface PendingAction {
  id: string;
  tool: string;
  summary: string;
  decision?: Decision;
}

type Turn =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; activity: string[]; actions: PendingAction[]; error?: string };

type ServerEvent =
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "navigate"; path: string }
  | { type: "confirm"; actions: { id: string; tool: string; summary: string }[] }
  | { type: "state"; messages: BetaMessageParam[] }
  | { type: "error"; message: string }
  | { type: "done" };

const STORAGE_KEY = "pleasant.assist.v1";

const SUGGESTIONS = {
  common: [
    "What needs my attention today?",
    "Which open shifts this week still need a carer?",
    "Who has DBS or right to work expiring this month?",
    "Approve the timesheets that are signed off by the client",
  ],
  admin: ["How much are clients overdue on invoices?"],
};

function load(): { turns: Turn[]; messages: BetaMessageParam[] } | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function save(turns: Turn[], messages: BetaMessageParam[]) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ turns, messages }));
  } catch {
    // Storage full or blocked: the conversation just won't survive a reload.
  }
}

export function AssistPanel({ role, firstName }: { role: string; firstName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [busy, setBusy] = useState(false);
  const [input, setInput] = useState("");
  const messagesRef = useRef<BetaMessageParam[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const saved = load();
    if (saved) {
      setTurns(saved.turns);
      messagesRef.current = saved.messages;
    }
  }, []);

  useEffect(() => {
    if (!busy) save(turns, messagesRef.current);
  }, [turns, busy]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [turns, open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  const updateLastAssistant = useCallback((fn: (t: Extract<Turn, { role: "assistant" }>) => Turn) => {
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

  const stream = useCallback(
    async (body: { messages: BetaMessageParam[]; decisions?: Record<string, Decision> }) => {
      setBusy(true);
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const res = await fetch("/api/assist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
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
            const event = JSON.parse(line) as ServerEvent;
            switch (event.type) {
              case "text":
                updateLastAssistant((t) => ({ ...t, text: t.text + event.delta }));
                break;
              case "tool":
                updateLastAssistant((t) =>
                  t.activity.includes(event.label) ? t : { ...t, activity: [...t.activity, event.label] },
                );
                break;
              case "navigate":
                router.push(event.path);
                break;
              case "confirm":
                updateLastAssistant((t) => ({ ...t, actions: [...t.actions, ...event.actions] }));
                break;
              case "state":
                messagesRef.current = event.messages;
                break;
              case "error":
                updateLastAssistant((t) => ({ ...t, error: event.message }));
                break;
            }
          }
        }
      } catch (error) {
        if ((error as Error).name !== "AbortError") {
          updateLastAssistant((t) => ({ ...t, error: (error as Error).message || "Assist is unavailable right now." }));
        }
      } finally {
        abortRef.current = null;
        setBusy(false);
        router.refresh();
      }
    },
    [router, updateLastAssistant],
  );

  const send = useCallback(
    (text: string) => {
      const prompt = text.trim();
      if (!prompt || busy) return;
      setInput("");
      setTurns((prev) => [
        ...prev,
        { role: "user", text: prompt },
        { role: "assistant", text: "", activity: [], actions: [] },
      ]);
      const messages: BetaMessageParam[] = [...messagesRef.current, { role: "user", content: prompt }];
      messagesRef.current = messages;
      void stream({ messages });
    },
    [busy, stream],
  );

  // Answer a confirmation card; once every card in the turn is answered, resume.
  const decide = useCallback(
    (actionId: string, decision: Decision) => {
      const idx = turns.length - 1;
      const last = turns[idx];
      if (last?.role !== "assistant" || busy) return;
      const actions = last.actions.map((a) =>
        a.id === actionId || (actionId === "*" && !a.decision) ? { ...a, decision } : a,
      );
      const next: Turn[] = [...turns.slice(0, idx), { ...last, actions }];
      if (actions.some((a) => !a.decision)) {
        setTurns(next);
        return;
      }
      setTurns([...next, { role: "assistant", text: "", activity: [], actions: [] }]);
      void stream({
        messages: messagesRef.current,
        decisions: Object.fromEntries(actions.map((a) => [a.id, a.decision!])),
      });
    },
    [turns, busy, stream],
  );

  const reset = () => {
    abortRef.current?.abort();
    messagesRef.current = [];
    setTurns([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    const onOpen = (e: Event) => {
      setOpen(true);
      const prompt = (e as CustomEvent<{ prompt?: string }>).detail?.prompt;
      if (prompt) setTimeout(() => send(prompt), 0);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_ASSIST_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_ASSIST_EVENT, onOpen);
    };
  }, [open, send]);

  const pendingCount = turns.at(-1)?.role === "assistant" ? (turns.at(-1) as Extract<Turn, { role: "assistant" }>).actions.filter((a) => !a.decision).length : 0;
  const suggestions = [...SUGGESTIONS.common, ...(role === "ADMIN" ? SUGGESTIONS.admin : [])];

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-slate-900 py-2.5 pl-3.5 pr-4 text-sm font-semibold text-white shadow-pop transition hover:bg-slate-800 active:scale-[0.98]"
          aria-label="Open Assist"
        >
          <Sparkles className="h-4 w-4 text-brand-300" />
          Assist
          <kbd className="ml-1 hidden rounded bg-white/10 px-1.5 text-[10px] font-medium text-white/70 sm:inline">⌘J</kbd>
        </button>
      ) : null}

      {open ? (
        <aside
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-pop sm:w-[440px]"
          aria-label="Assist"
        >
          <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              </span>
              <div className="leading-tight">
                <p className="font-display text-sm font-bold text-slate-900">Assist</p>
                <p className="hidden text-[11px] text-slate-500 sm:block">Works across Pleasant with your permissions</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close Assist"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-5" aria-live="polite">
            {turns.length === 0 ? (
              <div className="space-y-4">
                <div>
                  <p className="font-display text-lg font-bold text-slate-900">Hi {firstName}, what do you need?</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ask a question or tell Assist what to do: find and fill shifts, approve timesheets, set up
                    clients{role === "ADMIN" ? ", invoice and run payroll" : ""}. You confirm every change.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {turns.map((turn, i) =>
              turn.role === "user" ? (
                <div key={i} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-sm text-white">
                    {turn.text}
                  </p>
                </div>
              ) : (
                <div key={i} className="space-y-2.5">
                  {turn.activity.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {turn.activity.map((a) => (
                        <span key={a} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                          {busy && i === turns.length - 1 && a === turn.activity.at(-1) && !turn.text ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          {a}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {turn.text ? <AssistMarkdown text={turn.text} /> : null}
                  {!turn.text && !turn.error && turn.actions.length === 0 && busy && i === turns.length - 1 ? (
                    <p className="inline-flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
                    </p>
                  ) : null}
                  {turn.actions.length > 0 ? (
                    <div className="space-y-2">
                      {turn.actions.map((action) => (
                        <div key={action.id} className="rounded-xl border border-amber-200 bg-amber-50/60 p-3">
                          <p className="flex items-start gap-2 text-sm text-slate-800">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            {action.summary}
                          </p>
                          {action.decision ? (
                            <p className={cn("mt-2 text-xs font-medium", action.decision === "approve" ? "text-emerald-700" : "text-slate-500")}>
                              {action.decision === "approve" ? "Approved" : "Declined"}
                            </p>
                          ) : (
                            <div className="mt-2.5 flex gap-2">
                              <button
                                type="button"
                                onClick={() => decide(action.id, "approve")}
                                className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => decide(action.id, "decline")}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Decline
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {turn.actions.filter((a) => !a.decision).length > 1 ? (
                        <button
                          type="button"
                          onClick={() => decide("*", "approve")}
                          className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                        >
                          Approve all {turn.actions.filter((a) => !a.decision).length}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {turn.error ? (
                    <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                      {turn.error}
                    </p>
                  ) : null}
                </div>
              ),
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-slate-100 p-3"
          >
            <div className="rounded-2xl border border-slate-300 bg-white px-3 pb-2 pt-2 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10">
              <label htmlFor="assist-input" className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <Sparkles className="h-3 w-3 text-brand-500" /> Assist
              </label>
              <textarea
                id="assist-input"
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder={pendingCount > 0 ? "Approve or decline the change above first…" : "Ask anything, or tell Assist what to do…"}
                disabled={pendingCount > 0}
                className="mt-1 block w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed"
              />
              <div className="mt-1 flex items-center justify-between">
                <p className="text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
                {busy ? (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    aria-label="Stop"
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </button>
                ) : (
                  <button
                    type="submit"
                    aria-label="Send"
                    disabled={!input.trim() || pendingCount > 0}
                    className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          </form>
        </aside>
      ) : null}
    </>
  );
}
