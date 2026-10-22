"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  History,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Repeat,
  Search,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";

import type { ChatTurn, ConversationSummary } from "@/lib/assist/types";
import { cn } from "@/lib/utils";

import { ChatComposer } from "./ChatComposer";
import { ChatThread } from "./ChatThread";
import { assistSuggestions } from "./suggestions";
import { useAssistChat } from "./useAssistChat";

function group(conversations: ConversationSummary[]) {
  const now = Date.now();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const buckets: { label: string; items: ConversationSummary[] }[] = [
    { label: "Pinned", items: [] },
    { label: "Today", items: [] },
    { label: "Previous 7 days", items: [] },
    { label: "Older", items: [] },
  ];
  for (const c of conversations) {
    const t = new Date(c.updatedAt).getTime();
    if (c.pinned) buckets[0].items.push(c);
    else if (t >= startOfToday.getTime()) buckets[1].items.push(c);
    else if (now - t < 7 * 86_400_000) buckets[2].items.push(c);
    else buckets[3].items.push(c);
  }
  return buckets.filter((b) => b.items.length > 0);
}

async function patch(id: string, body: { title?: string; pinned?: boolean }) {
  await fetch(`/api/assist/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function HistoryItem({
  item,
  active,
  onOpen,
  onChanged,
  onDeleted,
}: {
  item: ConversationSummary;
  active: boolean;
  onOpen: () => void;
  onChanged: () => void;
  onDeleted: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(item.title);

  const saveTitle = async () => {
    setRenaming(false);
    if (title.trim() && title.trim() !== item.title) {
      await patch(item.id, { title: title.trim() });
      onChanged();
    } else {
      setTitle(item.title);
    }
  };

  if (renaming) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void saveTitle();
        }}
        className="flex items-center gap-1 px-1"
      >
        <input
          autoFocus
          value={title}
          maxLength={120}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => void saveTitle()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setTitle(item.title);
              setRenaming(false);
            }
          }}
          aria-label="Conversation title"
          className="min-w-0 flex-1 rounded-md border border-brand-400 bg-white px-2 py-1.5 text-sm outline-none ring-4 ring-brand-500/10"
        />
        <button type="submit" aria-label="Save title" className="rounded p-1 text-brand-700 hover:bg-brand-50">
          <Check className="h-4 w-4" />
        </button>
      </form>
    );
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 pr-8 text-left text-sm transition",
          active ? "bg-white font-medium text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70 hover:text-slate-900",
        )}
      >
        {item.automation ? <Repeat className="h-3.5 w-3.5 shrink-0 text-brand-600" aria-label="Automation run" /> : null}
        <span className="truncate">{item.title}</span>
      </button>
      <button
        type="button"
        aria-label={`Options for ${item.title}`}
        onClick={() => setMenu((v) => !v)}
        className={cn(
          "absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700",
          menu || active ? "opacity-100" : "opacity-0 group-hover:opacity-100 focus:opacity-100",
        )}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {menu ? (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setMenu(false)} aria-hidden="true" />
          <div className="absolute right-1 top-full z-20 mt-1 w-40 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-pop">
            <button
              type="button"
              onClick={async () => {
                setMenu(false);
                await patch(item.id, { pinned: !item.pinned });
                onChanged();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              {item.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
              {item.pinned ? "Unpin" : "Pin"}
            </button>
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setRenaming(true);
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-slate-700 hover:bg-slate-50"
            >
              <Pencil className="h-3.5 w-3.5" /> Rename
            </button>
            <button
              type="button"
              onClick={async () => {
                setMenu(false);
                if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
                await fetch(`/api/assist/conversations/${item.id}`, { method: "DELETE" });
                onDeleted();
              }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-red-600 hover:bg-red-50"
            >
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function AssistWorkspace({
  initial,
  conversations: initialConversations,
  role,
  firstName,
}: {
  initial: { id: string; title: string; turns: ChatTurn[]; automation: string | null } | null;
  conversations: ConversationSummary[];
  role: string;
  firstName: string;
}) {
  const router = useRouter();
  const [conversations, setConversations] = useState(initialConversations);
  const [query, setQuery] = useState("");
  const [showHistory, setShowHistory] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const refreshHistory = useCallback(async (q = query) => {
    const res = await fetch(`/api/assist/conversations${q ? `?q=${encodeURIComponent(q)}` : ""}`, { cache: "no-store" });
    if (res.ok) setConversations((await res.json()).conversations);
  }, [query]);

  const chat = useAssistChat({
    initial,
    onConversation: (id) => {
      // Update the address without remounting mid-stream.
      window.history.replaceState(null, "", `/assist/c/${id}`);
      void refreshHistory();
    },
    onSettled: () => void refreshHistory(),
  });

  useEffect(() => {
    const t = setTimeout(() => void refreshHistory(query), 200);
    return () => clearTimeout(t);
  }, [query, refreshHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [chat.turns]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const groups = useMemo(() => group(conversations), [conversations]);
  const activeId = chat.conversationId;

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="space-y-2 p-3">
        <button
          type="button"
          onClick={() => {
            chat.reset();
            setShowHistory(false);
            router.push("/assist");
            inputRef.current?.focus();
          }}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <MessageSquarePlus className="h-4 w-4" /> New chat
        </button>
        <label className="relative block">
          <span className="sr-only">Search conversations</span>
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history"
            className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm outline-none placeholder:text-slate-400 focus:border-brand-400"
          />
        </label>
      </div>
      <nav aria-label="Conversation history" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-2 pb-3">
        {groups.length === 0 ? (
          <p className="px-2 py-6 text-center text-xs text-slate-400">
            {query ? "No conversations match." : "Your conversations will appear here."}
          </p>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{g.label}</p>
              <div className="space-y-0.5">
                {g.items.map((item) => (
                  <HistoryItem
                    key={item.id}
                    item={item}
                    active={item.id === activeId}
                    onOpen={() => {
                      setShowHistory(false);
                      router.push(`/assist/c/${item.id}`);
                    }}
                    onChanged={() => void refreshHistory()}
                    onDeleted={() => {
                      if (item.id === activeId) router.push("/assist");
                      void refreshHistory();
                    }}
                  />
                ))}
              </div>
            </div>
          ))
        )}
      </nav>
    </div>
  );

  return (
    <div className="flex h-[calc(100dvh-13.5rem)] min-h-[520px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-card lg:h-[calc(100dvh-12rem)]">
      <aside className="hidden w-72 shrink-0 border-r border-slate-200 bg-slate-50/70 md:block">{sidebar}</aside>

      {showHistory ? (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setShowHistory(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85%] bg-slate-50 shadow-pop">
            <div className="flex justify-end p-2">
              <button type="button" aria-label="Close history" onClick={() => setShowHistory(false)} className="rounded p-1 text-slate-500">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      ) : null}

      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
          <button
            type="button"
            onClick={() => setShowHistory(true)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Show history"
          >
            <History className="h-4 w-4" />
          </button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-slate-900">{chat.title ?? "New conversation"}</p>
          {initial?.automation && chat.conversationId === initial.id ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-medium text-brand-700">
              <Repeat className="h-3 w-3" /> {initial.automation}
            </span>
          ) : null}
        </header>

        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto" aria-live="polite">
          <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
            {chat.turns.length === 0 ? (
              <div className="py-6 sm:py-12">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900">
                  <Sparkles className="h-5 w-5 text-brand-300" />
                </span>
                <h2 className="mt-4 font-display text-2xl font-bold tracking-tight text-slate-900">
                  Hi {firstName}, what can Assist do for you?
                </h2>
                <p className="mt-1.5 max-w-xl text-sm text-slate-500">
                  Ask about anything in Pleasant, or tell Assist what to do. It works with your permissions and asks you
                  to approve every change.
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                  {assistSuggestions(role).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => chat.send(s)}
                      className="rounded-xl border border-slate-200 px-3.5 py-3 text-left text-sm text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/50"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <ChatThread turns={chat.turns} busy={chat.busy} onDecide={chat.decide} wide />
            )}
          </div>
        </div>

        <div className="border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto w-full max-w-3xl">
            <ChatComposer
              ref={inputRef}
              id="assist-page-input"
              large
              onSend={chat.send}
              onStop={chat.stop}
              busy={chat.busy}
              pendingCount={chat.pendingCount}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
