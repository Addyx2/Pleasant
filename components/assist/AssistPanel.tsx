"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Maximize2, Plus, Sparkles, X } from "lucide-react";

import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { assistSuggestions } from "./suggestions";
import { useAssistChat } from "./useAssistChat";

export const OPEN_ASSIST_EVENT = "pleasant:open-assist";
const CURRENT_KEY = "pleasant.assist.current";

/** Open Assist from anywhere, optionally sending a prompt straight away. */
export function openAssist(prompt?: string) {
  window.dispatchEvent(new CustomEvent(OPEN_ASSIST_EVENT, { detail: { prompt } }));
}

function remember(id: string | null) {
  try {
    if (id) sessionStorage.setItem(CURRENT_KEY, id);
    else sessionStorage.removeItem(CURRENT_KEY);
  } catch {
    // Storage blocked: the panel just starts a fresh chat next time.
  }
}

export function AssistPanel({ role, firstName }: { role: string; firstName: string }) {
  const pathname = usePathname();
  const onAssistPage = pathname.startsWith("/persona/assist");
  const [open, setOpen] = useState(false);
  const restored = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const chat = useAssistChat({ onConversation: (id) => remember(id) });
  const { load, send } = chat;

  // Pick up the conversation from earlier in this browser session.
  useEffect(() => {
    if (!open || restored.current) return;
    restored.current = true;
    try {
      const id = sessionStorage.getItem(CURRENT_KEY);
      if (id) void load(id).then((ok) => (ok ? undefined : remember(null)));
    } catch {
      // ignore
    }
  }, [open, load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.turns, open]);

  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  useEffect(() => {
    if (onAssistPage) setOpen(false);
  }, [onAssistPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j" && !onAssistPage) {
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
  }, [open, send, onAssistPage]);

  if (onAssistPage) return null;

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
      ) : (
        <aside
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-slate-200 bg-white shadow-pop sm:w-[440px]"
          aria-label="Assist"
        >
          <header className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900">
                <Sparkles className="h-3.5 w-3.5 text-brand-300" />
              </span>
              <div className="min-w-0 leading-tight">
                <p className="font-display text-sm font-bold text-slate-900">
                  Assist <span className="ml-1 text-[10px] font-semibold uppercase tracking-wider text-brand-600">Persona</span>
                </p>
                <p className="truncate text-[11px] text-slate-500">{chat.title ?? "Works across Pleasant with your permissions"}</p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={() => {
                  chat.reset();
                  remember(null);
                }}
                className="inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
              >
                <Plus className="h-3.5 w-3.5" /> New chat
              </button>
              <Link
                href={chat.conversationId ? `/persona/assist/c/${chat.conversationId}` : "/persona/assist"}
                aria-label="Open full page"
                title="Open full page"
                className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              >
                <Maximize2 className="h-4 w-4" />
              </Link>
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

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-5" aria-live="polite">
            {chat.turns.length === 0 && !chat.loading ? (
              <div className="space-y-4">
                <div>
                  <p className="font-display text-lg font-bold text-slate-900">Hi {firstName}, what do you need?</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Ask a question or tell Assist what to do: find and fill shifts, approve timesheets, set up
                    clients{role === "ADMIN" ? ", invoice and run payroll" : ""}. You confirm every change.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  {assistSuggestions(role).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => chat.send(s)}
                      className="rounded-lg border border-slate-200 px-3 py-2 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ChatThread turns={chat.turns} busy={chat.busy} onDecide={chat.decide} />
            )}
          </div>

          <div className="border-t border-slate-100 p-3">
            <ChatComposer
              ref={inputRef}
              onSend={chat.send}
              onStop={chat.stop}
              busy={chat.busy}
              pendingCount={chat.pendingCount}
            />
          </div>
        </aside>
      )}
    </>
  );
}
