"use client";

import { useActionState, useState } from "react";

import { WEEKDAY_NAMES } from "@/lib/availability-names";

import { addUnavailabilityAction, type AvailabilityState } from "./actions";

const input = "mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500";

export function AvailabilityForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<AvailabilityState, FormData>(addUnavailabilityAction, {});
  const [kind, setKind] = useState<"dates" | "weekly">("dates");
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white active:scale-[0.99]">
        Add a time you can&apos;t work
      </button>
    );
  }
  return (
    <form action={action} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 text-sm font-medium">
        {(["dates", "weekly"] as const).map((k) => (
          <button key={k} type="button" onClick={() => setKind(k)} className={`rounded-lg py-1.5 ${kind === k ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"}`}>
            {k === "dates" ? "Some days" : "Every week"}
          </button>
        ))}
      </div>
      <input type="hidden" name="kind" value={kind} />
      {kind === "dates" ? (
        <div key="dates" className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">From<input type="date" name="from" min={today} defaultValue={today} required className={input} /></label>
          <label className="text-xs font-medium text-slate-600">To<input type="date" name="to" min={today} defaultValue={today} required className={input} /></label>
        </div>
      ) : (
        <div key="weekly" className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">Every
            <select name="weekday" defaultValue="2" className={input}>{WEEKDAY_NAMES.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</select>
          </label>
          <label className="text-xs font-medium text-slate-600">Until (optional)<input type="date" name="until" min={today} className={input} /></label>
        </div>
      )}
      <label className="block text-xs font-medium text-slate-600">Reason (optional, your agency sees it)
        <input name="reason" maxLength={80} placeholder={kind === "weekly" ? "Childcare" : "Holiday"} className={input} />
      </label>
      {state.error ? <p role="alert" className="text-sm text-red-700">{state.error}</p> : state.ok ? <p role="status" className="text-sm text-emerald-700">{state.ok}</p> : null}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="flex-1 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600">Close</button>
      </div>
    </form>
  );
}
