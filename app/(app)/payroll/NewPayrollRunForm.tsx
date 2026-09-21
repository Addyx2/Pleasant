"use client";

import { useActionState } from "react";

import { generatePayrollRunAction } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/app/(app)/shifts/actions";

const initialState: ActionState = {};

export function NewPayrollRunForm({
  defaultStart,
  defaultEnd,
  defaultPayDate,
}: {
  defaultStart: string;
  defaultEnd: string;
  defaultPayDate: string;
}) {
  const [state, formAction, pending] = useActionState(generatePayrollRunAction, initialState);

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="periodStart">Period start</label>
        <input id="periodStart" name="periodStart" type="date" required defaultValue={defaultStart} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="periodEnd">Period end</label>
        <input id="periodEnd" name="periodEnd" type="date" required defaultValue={defaultEnd} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="payDate">Pay date</label>
        <input id="payDate" name="payDate" type="date" required defaultValue={defaultPayDate} className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="period">Pay frequency</label>
        <select id="period" name="period" className={inputClass} defaultValue="MONTHLY">
          <option value="WEEKLY">Weekly</option>
          <option value="FORTNIGHTLY">Fortnightly</option>
          <option value="FOUR_WEEKLY">Every 4 weeks</option>
          <option value="MONTHLY">Monthly</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="reference">Reference (optional)</label>
        <input id="reference" name="reference" className={inputClass} placeholder="2026-09-M1" />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Calculating…" : "Generate payroll run"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Payslips are built from approved timesheets whose shifts fall inside the period.
        </p>
      </div>
    </form>
  );
}
