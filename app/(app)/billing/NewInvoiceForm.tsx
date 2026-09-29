"use client";

import { useActionState, useState } from "react";

import { buttonClass, inputClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/app/(app)/shifts/actions";
import { createInvoiceAction } from "./actions";

const initialState: ActionState = {};

export function NewInvoiceForm({
  clients,
  defaultStart,
  defaultEnd,
  defaultDueDate,
}: {
  clients: { id: string; name: string }[];
  defaultStart: string;
  defaultEnd: string;
  defaultDueDate: string;
}) {
  const [state, formAction, pending] = useActionState(createInvoiceAction, initialState);
  const [clientId, setClientId] = useState("");

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="clientId">Client to bill</label>
        <select
          id="clientId"
          name="clientId"
          required
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
          className={inputClass}
        >
          <option value="">
            {clients.length === 0 ? "No clients yet" : "Choose a client"}
          </option>
          {clients.map((client) => (
            <option key={client.id} value={client.id}>
              {client.name}
            </option>
          ))}
        </select>
        {clientId && (
          <p className="mt-1 text-xs text-slate-500">
            Lines are built from approved, client-authorised timesheets in this period.
          </p>
        )}
      </div>
      <div>
        <label className={labelClass} htmlFor="periodStart">Period start</label>
        <input id="periodStart" name="periodStart" type="date" required defaultValue={defaultStart} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="periodEnd">Period end</label>
        <input id="periodEnd" name="periodEnd" type="date" required defaultValue={defaultEnd} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="dueDate">Due date</label>
        <input id="dueDate" name="dueDate" type="date" required defaultValue={defaultDueDate} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="vatRatePct">VAT</label>
        <select id="vatRatePct" name="vatRatePct" className={inputClass} defaultValue="0">
          <option value="0">Exempt / zero-rated (0%)</option>
          <option value="20">Standard rate (20%)</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="reference">Reference (optional)</label>
        <input id="reference" name="reference" className={inputClass} placeholder="INV-202610-0001" />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Building invoice…" : "Generate invoice"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Approved timesheets already included on an earlier invoice are skipped.
        </p>
      </div>
    </form>
  );
}