"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";

import { createPleasantLinkAction } from "@/app/(app)/clients/actions";

interface GenerateLinkButtonProps {
  clientId: string;
  clientName: string;
}

interface LinkState {
  error?: string;
  success?: string;
  link?: string;
}

export function GenerateLinkButton({ clientId, clientName }: GenerateLinkButtonProps) {
  const [copied, setCopied] = useState(false);
  const [state, formAction, pending] = useActionState<LinkState, FormData>(
    async (_prev) => ({ ...(await createPleasantLinkAction(clientId)) }),
    {},
  );

  const fullUrl =
    typeof window !== "undefined" && state.link
      ? `${window.location.origin}${state.link}`
      : state.link ?? "";

  const copy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction}>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15 transition hover:bg-brand-100 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
          {state.link ? "New link" : "Pleasant Link"}
        </button>
      </form>
      {state.link ? (
        <div className="flex items-center gap-1.5">
          <code className="max-w-[220px] truncate rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
            {fullUrl}
          </code>
          <button
            type="button"
            onClick={copy}
            className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1 text-[11px] font-semibold text-white transition hover:bg-slate-700"
            title="Copy link"
          >
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
      {state.error ? (
        <p className="text-[11px] font-medium text-red-600" title={`for ${clientName}`}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}