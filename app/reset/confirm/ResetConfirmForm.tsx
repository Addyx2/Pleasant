"use client";

import { useActionState } from "react";
import Link from "next/link";

import { confirmResetAction, type ResetConfirmState } from "./actions";

const initialState: ResetConfirmState = {};

export function ResetConfirmForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(confirmResetAction, initialState);

  if (state.ok) {
    return (
      <div className="space-y-4 text-center">
        <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
          Password updated.
        </p>
        <Link
          href="/login"
          className="inline-block w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          New password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={8}
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
        />
      </div>

      {state.error ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {pending ? "Updating…" : "Update password"}
      </button>
    </form>
  );
}