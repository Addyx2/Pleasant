"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2, Share2 } from "lucide-react";

import { Card, buttonClass, subtleButtonClass } from "@/components/ui";

import { createAultrumLinkAction, disconnectAultrumAction, type AultrumLinkState } from "../actions";

/**
 * The carer's Aultrum app: an Aultrum Link to send them (like a server
 * invite), or their connection once they've joined.
 */
export function AultrumAppCard({ staffId, firstName, connected }: { staffId: string; firstName: string; connected: boolean }) {
  const [state, create, pending] = useActionState<AultrumLinkState, FormData>(() => createAultrumLinkAction(staffId), {});
  const [copied, setCopied] = useState(false);
  const link = state.link;
  const message = link ? `Join us on the Aultrum app to see your shifts: ${link.url} (or enter code ${link.code})` : "";

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900"><Link2 className="h-4 w-4 text-brand-600" /> Aultrum app</h2>
          <p className="mt-1 text-xs text-slate-500">
            {connected
              ? `${firstName} has joined you in the Aultrum app: they see their shifts, offers, Pool and checks there.`
              : `Send ${firstName} an Aultrum Link. They open it (or type its code) in the Aultrum app and you appear there, with their shifts. No Pleasant login needed.`}
          </p>
        </div>
        {connected ? <span className="shrink-0 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Connected</span> : null}
      </div>

      {link ? (
        <div className="mt-4 space-y-3 rounded-xl border border-brand-200 bg-brand-50/50 p-4">
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
                await navigator.clipboard.writeText(message);
                setCopied(true);
              }}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy invite"}
            </button>
            {typeof navigator !== "undefined" && "share" in navigator ? (
              <button type="button" className={subtleButtonClass} onClick={() => navigator.share({ text: message }).catch(() => undefined)}>
                <Share2 className="h-4 w-4" /> Share
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {state.error ? <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <form action={create}>
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Making link…" : link ? "Make a new link" : connected ? "Send a new link" : "Create Aultrum Link"}
          </button>
        </form>
        {connected ? (
          <form action={disconnectAultrumAction}>
            <input type="hidden" name="staffId" value={staffId} />
            <button type="submit" className={subtleButtonClass}>Disconnect</button>
          </form>
        ) : null}
      </div>
    </Card>
  );
}
