"use client";

import { useActionState } from "react";

import { createInviteAction, type InviteState } from "../actions";

const initialState: InviteState = {};

export function InviteForm({
  staffId,
  email,
  hasAccount,
}: {
  staffId: string;
  email: string;
  hasAccount: boolean;
}) {
  const [state, formAction, pending] = useActionState(createInviteAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="staffId" value={staffId} />

      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
        Invite goes to <span className="font-medium text-slate-800">{email}</span>
      </div>

      {state.ok ? (
        <div className="space-y-2">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            {state.delivered
              ? `The invite link was sent to ${email}.`
              : "Email delivery is not configured — copy the link below and send it yourself."}
          </p>
          {state.link ? (
            <p className="break-all rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {state.link}
            </p>
          ) : null}
        </div>
      ) : null}

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Creating link…" : hasAccount ? "Send a new invite link" : "Create login + invite"}
      </button>
    </form>
  );
}