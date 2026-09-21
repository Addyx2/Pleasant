"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { createClientAction, createSiteAction } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/app/(app)/shifts/actions";

const initialState: ActionState = {};

export function NewClientForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createClientAction(prev, formData);
    if (result.success) router.refresh();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass} htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="lastName">Last name</label>
          <input id="lastName" name="lastName" required className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="careLevel">Care level</label>
          <input id="careLevel" name="careLevel" className={inputClass} placeholder="Low / Medium / High / Complex" />
        </div>
        <div>
          <label className={labelClass} htmlFor="phone">Phone</label>
          <input id="phone" name="phone" className={inputClass} />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="address">Address</label>
          <input id="address" name="address" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="postcode">Postcode</label>
          <input id="postcode" name="postcode" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="notes">Notes</label>
          <input id="notes" name="notes" className={inputClass} />
        </div>
      </div>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Add client"}
      </button>
    </form>
  );
}

export function NewSiteForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createSiteAction(prev, formData);
    if (result.success) router.refresh();
    return result;
  }, initialState);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className={labelClass} htmlFor="name">Site name</label>
        <input id="name" name="name" required className={inputClass} placeholder="Meadow View Care Home" />
      </div>
      <div>
        <label className={labelClass} htmlFor="address">Address</label>
        <input id="address" name="address" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="postcode">Postcode</label>
        <input id="postcode" name="postcode" className={inputClass} />
      </div>
      {state.error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p> : null}
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : "Add site"}
      </button>
    </form>
  );
}
