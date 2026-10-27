"use client";

import { useActionState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";

import { linkAultrumAction, type LinkState } from "./actions";

export function LinkForm({ email }: { email: string }) {
  const [state, action, pending] = useActionState<LinkState, FormData>(linkAultrumAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      <div>
        <label htmlFor="password" className={labelClass}>Your Pleasant password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required autoFocus className={`mt-1 ${inputClass}`} />
      </div>
      {state.error ? <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={`${buttonClass} w-full`}>
        {pending ? "Linking…" : "Link and sign in"}
      </button>
    </form>
  );
}
