"use client";

import { useActionState } from "react";
import { BadgeCheck, ClipboardCheck, Loader2 } from "lucide-react";

import { signOffTimesheet } from "@/lib/clientpoint/actions";

interface SignOffFormProps {
  token: string;
  timesheetId: string;
  clientName: string;
  staffName: string;
  roleTitle: string;
  dateLabel: string;
  hoursLabel: string;
}

interface SignOffState {
  success?: boolean;
  message?: string;
}

export function SignOffForm({
  token,
  timesheetId,
  clientName,
  staffName,
  roleTitle,
  dateLabel,
  hoursLabel,
}: SignOffFormProps) {
  const [state, formAction, pending] = useActionState<SignOffState, FormData>(
    async (_prev) => signOffTimesheet(token, timesheetId, clientName, "Site Manager via Pleasant Link"),
    {},
  );

  if (state.success) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
        <BadgeCheck className="h-3.5 w-3.5" /> Signed off
      </span>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <div className="text-sm text-slate-700">
        <span className="font-semibold text-slate-900">{staffName}</span>
        <span className="text-slate-500"> · {roleTitle}</span>
      </div>
      <p className="text-xs text-slate-500">
        {dateLabel} · {hoursLabel} worked
      </p>
      <form action={formAction} className="mt-1">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
        >
          {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardCheck className="h-3.5 w-3.5" />}
          Approve & sign
        </button>
      </form>
      {state.message ? <p className="text-xs font-medium text-red-600">{state.message}</p> : null}
    </div>
  );
}