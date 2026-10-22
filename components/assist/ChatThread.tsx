"use client";

import { Check, Loader2, ShieldCheck, X as XIcon } from "lucide-react";

import type { ChatTurn, Decision } from "@/lib/assist/types";
import { cn } from "@/lib/utils";

import { AssistMarkdown } from "./AssistMarkdown";

export function ChatThread({
  turns,
  busy,
  onDecide,
  wide = false,
}: {
  turns: ChatTurn[];
  busy: boolean;
  onDecide: (actionId: string | "*", decision: Decision) => void;
  wide?: boolean;
}) {
  return (
    <div className={cn("space-y-5", wide && "space-y-7")}>
      {turns.map((turn, i) => {
        const live = busy && i === turns.length - 1;
        if (turn.role === "user") {
          return (
            <div key={i} className="flex justify-end">
              <p
                className={cn(
                  "whitespace-pre-wrap rounded-2xl rounded-br-md bg-slate-900 px-3.5 py-2 text-sm text-white",
                  wide ? "max-w-[75%]" : "max-w-[85%]",
                )}
              >
                {turn.text}
              </p>
            </div>
          );
        }
        const open = turn.actions.filter((a) => !a.decision);
        return (
          <div key={i} className="space-y-2.5">
            {turn.activity.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {turn.activity.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500"
                  >
                    {live && a === turn.activity.at(-1) && !turn.text ? (
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
            {!turn.text && !turn.error && turn.actions.length === 0 && live ? (
              <p className="inline-flex items-center gap-2 text-sm text-slate-400">
                <Loader2 className="h-4 w-4 animate-spin" /> Thinking…
              </p>
            ) : null}
            {turn.actions.length > 0 ? (
              <div className="space-y-2">
                {turn.actions.map((action) => (
                  <div
                    key={action.id}
                    className={cn(
                      "rounded-xl border p-3",
                      action.decision ? "border-slate-200 bg-slate-50/60" : "border-amber-200 bg-amber-50/60",
                    )}
                  >
                    <p className="flex items-start gap-2 text-sm text-slate-800">
                      <ShieldCheck
                        className={cn("mt-0.5 h-4 w-4 shrink-0", action.decision ? "text-slate-400" : "text-amber-600")}
                      />
                      {action.summary}
                    </p>
                    {action.decision ? (
                      <p
                        className={cn(
                          "mt-2 inline-flex items-center gap-1 text-xs font-medium",
                          action.failed ? "text-red-600" : action.decision === "approve" ? "text-emerald-700" : "text-slate-500",
                        )}
                      >
                        {action.failed ? (
                          <>
                            <XIcon className="h-3.5 w-3.5" /> Approved, but it didn&apos;t go through
                          </>
                        ) : action.decision === "approve" ? (
                          <>
                            <Check className="h-3.5 w-3.5" /> Approved
                          </>
                        ) : (
                          "Declined"
                        )}
                      </p>
                    ) : (
                      <div className="mt-2.5 flex gap-2">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDecide(action.id, "approve")}
                          className="inline-flex items-center gap-1 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                        >
                          <Check className="h-3.5 w-3.5" /> Approve
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => onDecide(action.id, "decline")}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {open.length > 1 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onDecide("*", "approve")}
                    className="text-xs font-semibold text-brand-700 hover:text-brand-800"
                  >
                    Approve all {open.length}
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
        );
      })}
    </div>
  );
}
