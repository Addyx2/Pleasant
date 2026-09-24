"use client";

import { useActionState } from "react";

import { requestResetAction, type ResetRequestState } from "./actions";

const initialState: ResetRequestState = {};

export function ResetRequestForm() {
  const [state, formAction, pending] = useActionState(requestResetAction, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Work email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {state.ok ? (
        <div className="space-y-2">
          <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
            If an account exists for this email, a reset link has been sent.
          </p>
          {state.link ? (
            <details className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <summary className="cursor-pointer font-medium">
                Email delivery is not configured — copy the link below
              </summary>
              <p className="mt-2 break-all">{state.link}</p>
            </details>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}