"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Share2 } from "lucide-react";

import { buttonClass, subtleButtonClass } from "@/components/ui";

export interface InviteState {
  error?: string;
  link?: { code: string; url: string; expiresAt: string };
}

/**
 * Makes an Aultrum Link and shows it to send: its code, its address, and
 * copy and share buttons. `create` is a server action bound to who it's for.
 */
export function AultrumInvite({ create, label, message }: { create: () => Promise<InviteState>; label: string; message: string }) {
  const [state, run, pending] = useActionState<InviteState, FormData>(() => create(), {});
  const [copied, setCopied] = useState(false);
  const link = state.link;
  const text = link ? `${message}: ${link.url} (or enter code ${link.code})` : "";

  return (
    <div className="space-y-3">
      {link ? (
        <div className="space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-mono text-2xl font-bold tracking-widest text-slate-900">{link.code}</span>
            <span className="text-xs text-slate-500">works once · until {new Date(link.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
          </div>
          <p className="break-all font-mono text-xs text-slate-600">{link.url}</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={subtleButtonClass}
              onClick={async () => {
                await navigator.clipboard.writeText(text);
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy invite"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <button type="button" className={subtleButtonClass} onClick={() => navigator.share({ text }).catch(() => undefined)}>
                <Share2 className="h-4 w-4" /> Share
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : null}
      <form action={run}>
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Making link…" : link ? "Make a new link" : label}
        </button>
      </form>
    </div>
  );
}
