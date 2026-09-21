"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { createStaffAction } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";
import type { ActionState } from "@/app/(app)/shifts/actions";

const initialState: ActionState = {};

export function NewStaffForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createStaffAction(prev, formData);
    if (result.success) router.push("/staff");
    return result;
  }, initialState);

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="firstName">First name</label>
        <input id="firstName" name="firstName" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="lastName">Last name</label>
        <input id="lastName" name="lastName" required className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="jobTitle">Job title</label>
        <input id="jobTitle" name="jobTitle" required className={inputClass} placeholder="Care Assistant" />
      </div>
      <div>
        <label className={labelClass} htmlFor="band">Band / grade</label>
        <input id="band" name="band" className={inputClass} placeholder="Senior" />
      </div>
      <div>
        <label className={labelClass} htmlFor="email">Email</label>
        <input id="email" name="email" type="email" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="phone">Phone</label>
        <input id="phone" name="phone" className={inputClass} />
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Payroll</h3>
      </div>
      <div>
        <label className={labelClass} htmlFor="niNumber">NI number</label>
        <input id="niNumber" name="niNumber" className={inputClass} placeholder="QQ 12 34 56 C" />
      </div>
      <div>
        <label className={labelClass} htmlFor="taxCode">Tax code</label>
        <input id="taxCode" name="taxCode" defaultValue="1257L" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="studentLoanPlan">Student loan</label>
        <select id="studentLoanPlan" name="studentLoanPlan" className={inputClass} defaultValue="NONE">
          <option value="NONE">None</option>
          <option value="PLAN_1">Plan 1</option>
          <option value="PLAN_2">Plan 2</option>
          <option value="PLAN_4">Plan 4 (Scotland)</option>
          <option value="PLAN_5">Plan 5</option>
          <option value="POSTGRAD">Postgraduate</option>
        </select>
      </div>
      <div>
        <label className={labelClass} htmlFor="holidayAccrualPct">Holiday accrual (%)</label>
        <input id="holidayAccrualPct" name="holidayAccrualPct" type="number" step="0.01" min="0" defaultValue="12.07" className={inputClass} />
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Rates (£/hour)</h3>
      </div>
      <div>
        <label className={labelClass} htmlFor="baseRate">Base rate</label>
        <input id="baseRate" name="baseRate" type="number" step="0.01" min="0" required defaultValue="12.71" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="nightRate">Night rate</label>
        <input id="nightRate" name="nightRate" type="number" step="0.01" min="0" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="weekendRate">Weekend rate</label>
        <input id="weekendRate" name="weekendRate" type="number" step="0.01" min="0" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="bankHolidayRate">Bank holiday rate</label>
        <input id="bankHolidayRate" name="bankHolidayRate" type="number" step="0.01" min="0" className={inputClass} />
      </div>

      <div className="sm:col-span-2 mt-2 border-t border-slate-100 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Pension</h3>
      </div>
      <div className="flex items-center gap-2 sm:col-span-2">
        <input id="pensionEnrolled" name="pensionEnrolled" type="checkbox" defaultChecked className="h-4 w-4 rounded border-slate-300" />
        <label htmlFor="pensionEnrolled" className="text-sm text-slate-700">Enrolled in the workplace pension</label>
      </div>
      <div>
        <label className={labelClass} htmlFor="pensionEmployeePct">Employee contribution (%)</label>
        <input id="pensionEmployeePct" name="pensionEmployeePct" type="number" step="0.1" min="0" defaultValue="5" className={inputClass} />
      </div>
      <div>
        <label className={labelClass} htmlFor="pensionEmployerPct">Employer contribution (%)</label>
        <input id="pensionEmployerPct" name="pensionEmployerPct" type="number" step="0.1" min="0" defaultValue="3" className={inputClass} />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Saving…" : "Add carer"}
        </button>
      </div>
    </form>
  );
}
