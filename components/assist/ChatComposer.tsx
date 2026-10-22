"use client";

import { forwardRef, useState } from "react";
import { ArrowUp, Sparkles, Square } from "lucide-react";

import { cn } from "@/lib/utils";

/** The prompt box titled "Assist", shared by the panel and the full page. */
export const ChatComposer = forwardRef<
  HTMLTextAreaElement,
  {
    onSend: (text: string) => void;
    onStop: () => void;
    busy: boolean;
    pendingCount: number;
    large?: boolean;
    id?: string;
  }
>(function ChatComposer({ onSend, onStop, busy, pendingCount, large = false, id = "assist-input" }, ref) {
  const [input, setInput] = useState("");
  const blocked = pendingCount > 0;

  const submit = () => {
    if (!input.trim() || busy || blocked) return;
    onSend(input);
    setInput("");
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div
        className={cn(
          "rounded-2xl border border-slate-300 bg-white px-3 pb-2 pt-2 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/10",
          large && "px-4 pt-3 shadow-card-hover",
        )}
      >
        <label htmlFor={id} className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          <Sparkles className="h-3 w-3 text-brand-500" /> Assist
        </label>
        <textarea
          id={id}
          ref={ref}
          value={input}
          onChange={(e) => {
            setInput(e.target.value);
            e.target.style.height = "auto";
            e.target.style.height = `${Math.min(e.target.scrollHeight, large ? 240 : 160)}px`;
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={large ? 3 : 2}
          maxLength={4000}
          placeholder={blocked ? "Approve or decline the change above first…" : "Ask anything, or tell Assist what to do…"}
          disabled={blocked}
          className={cn(
            "mt-1 block w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 disabled:cursor-not-allowed",
            large && "text-[15px]",
          )}
        />
        <div className="mt-1 flex items-center justify-between">
          <p className="text-[11px] text-slate-400">Enter to send · Shift+Enter for a new line</p>
          {busy ? (
            <button
              type="button"
              onClick={onStop}
              aria-label="Stop"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-white hover:bg-slate-700"
            >
              <Square className="h-3 w-3 fill-current" />
            </button>
          ) : (
            <button
              type="submit"
              aria-label="Send"
              disabled={!input.trim() || blocked}
              className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-white transition hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
});
