"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";

import { createShiftAction, type ActionState } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

const initialState: ActionState = {};

interface Option {
  id: string;
  label: string;
}

export function NewShiftForm({
  clients,
  sites,
  staff,
}: {
  clients: Option[];
  sites: Option[];
  staff: Option[];
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createShiftAction(prev, formData);
    if (result.success) router.push("/shifts");
    return result;
  }, initialState);

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="title">Shift title</label>
        <input id="title" name="title" required className={inputClass} placeholder="Morning care call" />
      </div>

      <div>
        <label className={labelClass} htmlFor="role">Role required</label>
        <input id="role" name="role" required className={inputClass} placeholder="Care Assistant" />
      </div>

      <div>
        <label className={labelClass} htmlFor="chargeRate">Charge rate to client (£/hr)</label>
        <input id="chargeRate" name="chargeRate" type="number" step="0.01" min="0" defaultValue="18.50" className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="clientId">Client</label>
        <select id="clientId" name="clientId" className={inputClass} defaultValue="">
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="siteId">Site</label>
        <select id="siteId" name="siteId" className={inputClass} defaultValue="">
          <option value="">No site</option>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="startAt">Starts</label>
        <input id="startAt" name="startAt" type="datetime-local" required className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="endAt">Ends</label>
        <input id="endAt" name="endAt" type="datetime-local" required className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="breakMins">Unpaid break (minutes)</label>
        <input id="breakMins" name="breakMins" type="number" min="0" step="5" defaultValue="0" className={inputClass} />
      </div>

      <div>
        <label className={labelClass} htmlFor="staffId">Assign carer (optional)</label>
        <select id="staffId" name="staffId" className={inputClass} defaultValue="">
          <option value="">Leave open</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="notes">Notes</label>
        <textarea id="notes" name="notes" rows={3} className={inputClass} placeholder="Access details, medication, etc." />
      </div>

      {state.error ? (
        <p className="sm:col-span-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{state.error}</p>
      ) : null}

      <div className="sm:col-span-2">
        <button type="submit" disabled={pending} className={buttonClass}>
          {pending ? "Creating…" : "Create shift"}
        </button>
      </div>
    </form>
  );
}
