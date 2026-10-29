"use client";

import { useActionState, useState } from "react";
import { Check, Copy, Link2, Loader2 } from "lucide-react";

import { createPleasantLinkAction } from "@/app/(app)/clients/actions";

interface Signatory {
  id: string;
  name: string;
  jobTitle: string | null;
}

interface LinkState {
  error?: string;
  success?: string;
  link?: string;
  contactName?: string;
}

/** Issues a 24-hour Aultrum Link in a named signatory's name. */
export function GenerateLinkButton({
  clientId,
  signatories,
}: {
  clientId: string;
  signatories: Signatory[];
}) {
  const [copied, setCopied] = useState(false);
  const [contactId, setContactId] = useState(signatories[0]?.id ?? "");
  const [state, formAction, pending] = useActionState<LinkState, FormData>(
    async () => ({ ...(await createPleasantLinkAction(clientId, contactId)) }),
    {},
  );

  if (signatories.length === 0) {
    return (
      <p className="text-xs text-slate-500">
        Add a contact and tick <span className="font-medium">Can sign timesheets</span> to issue a
        Aultrum Link.
      </p>
    );
  }

  const fullUrl =
    typeof window !== "undefined" && state.link ? `${window.location.origin}${state.link}` : (state.link ?? "");

  const copy = async () => {
    if (!fullUrl) return;
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <form action={formAction} className="flex flex-wrap items-center gap-2">
        <label htmlFor="link-contact" className="sr-only">
          Signatory
        </label>
        <select
          id="link-contact"
          value={contactId}
          onChange={(e) => setContactId(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
        >
          {signatories.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
              {s.jobTitle ? ` — ${s.jobTitle}` : ""}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={pending || !contactId}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          {state.link ? "New link" : "Create link"}
        </button>
      </form>
      {state.link ? (
        <div className="space-y-1.5">
          <p className="text-xs text-slate-500">
            Valid for 24 hours. Sign-offs are recorded in {state.contactName}&apos;s name.
          </p>
          <div className="flex items-center gap-1.5">
            <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1.5 text-[11px] text-slate-700">
              {fullUrl}
            </code>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-1 rounded bg-slate-900 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-slate-700"
            >
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </div>
      ) : null}
      {state.error ? <p className="text-xs font-medium text-red-600">{state.error}</p> : null}
    </div>
  );
}
