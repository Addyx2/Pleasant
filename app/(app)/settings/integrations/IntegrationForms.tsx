"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Copy, Loader2, TriangleAlert } from "lucide-react";

import { cn } from "@/lib/utils";
import { buttonClass, subtleButtonClass } from "@/components/ui";

import type { FormState } from "./actions";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** A form for a server action that reports back a one-line result. */
export function ActionForm({
  action,
  submitLabel,
  pendingLabel = "Working…",
  subtle = false,
  className,
  children,
}: {
  action: Action;
  submitLabel: string;
  pendingLabel?: string;
  subtle?: boolean;
  className?: string;
  /** A function receives the last result, e.g. to refill fields after an error. */
  children?: React.ReactNode | ((state: FormState) => React.ReactNode);
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, {});
  return (
    <form action={formAction} className={cn("space-y-3", className)}>
      {typeof children === "function" ? children(state) : children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={cn(subtle ? subtleButtonClass : buttonClass, "py-1.5 text-sm")}>
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          {pending ? pendingLabel : submitLabel}
        </button>
      </div>
      {state.message ? (
        <p role="status" className={cn("flex items-start gap-1.5 text-xs", state.ok ? "text-emerald-700" : "text-red-600")}>
          {state.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <code className="min-w-0 flex-1 truncate rounded bg-slate-100 px-2 py-1 text-[12px] text-slate-700" title={value}>
        {value}
      </code>
      <button
        type="button"
        aria-label={label}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          });
        }}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
      >
        <Copy className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}

const input =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";
const label = "block text-xs font-medium text-slate-600";

export function TwilioForm({
  action,
  connected,
  defaults,
}: {
  action: Action;
  connected: boolean;
  defaults: { accountSid: string; from: string; offers: boolean };
}) {
  return (
    <ActionForm action={action} submitLabel={connected ? "Save changes" : "Connect"} pendingLabel="Checking with Twilio…" subtle={connected}>
      {(state) => {
        const v = state.ok ? undefined : state.values;
        return (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label htmlFor="tw-sid" className={label}>Account SID</label>
              <input id="tw-sid" name="accountSid" required autoComplete="off" spellCheck={false} defaultValue={v?.accountSid ?? defaults.accountSid} placeholder="AC…" className={input} />
            </div>
            <div className="space-y-1">
              <label htmlFor="tw-token" className={label}>Auth Token</label>
              <input
                id="tw-token"
                name="authToken"
                type="password"
                autoComplete="off"
                required={!connected}
                placeholder={connected ? "Saved · leave blank to keep" : ""}
                className={input}
              />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label htmlFor="tw-from" className={label}>Send from</label>
              <input id="tw-from" name="from" required defaultValue={v?.from ?? defaults.from} placeholder="+447700900123 or MG… (Messaging Service)" className={input} />
            </div>
            <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
              <input type="checkbox" name="offers" defaultChecked={v ? v.offers === "on" : defaults.offers} className="h-4 w-4 rounded border-slate-300 text-brand-600" />
              Text shift offers to carers, who reply YES or NO
            </label>
          </div>
        );
      }}
    </ActionForm>
  );
}

export function TestSmsForm({ action }: { action: Action }) {
  return (
    <ActionForm action={action} submitLabel="Send test text" pendingLabel="Sending…" subtle>
      {(state) => (
        <div className="space-y-1">
          <label htmlFor="tw-to" className={label}>Send a test text to</label>
          <input id="tw-to" name="to" type="tel" required defaultValue={state.ok ? "" : (state.values?.to ?? "")} placeholder="07700 900123" className={input} />
        </div>
      )}
    </ActionForm>
  );
}
