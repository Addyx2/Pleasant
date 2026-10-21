"use client";

import { useActionState } from "react";
import { Loader2, Send } from "lucide-react";

import { requestShifts } from "@/lib/clientpoint/actions";

interface RequestStaffFormProps {
  token: string;
  /** Roles on the client's rate card; falls back to common roles when empty. */
  roles: string[];
}

const DEFAULT_ROLES = ["Care Assistant", "Senior Care Assistant", "Registered Nurse", "Support Worker"];

interface RequestState {
  success?: boolean;
  shiftId?: string;
  message?: string;
}

export function RequestStaffForm({ token, roles }: RequestStaffFormProps) {
  const options = roles.length > 0 ? roles : DEFAULT_ROLES;
  const [state, formAction, pending] = useActionState<RequestState, FormData>(
    async (_prev, formData) => {
      const role = String(formData.get("role") ?? "");
      const startAt = new Date(String(formData.get("startAt") ?? ""));
      const endAt = new Date(String(formData.get("endAt") ?? ""));
      const notes = String(formData.get("notes") ?? "") || undefined;
      if (!role || Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime())) {
        return { success: false, message: "Please fill in role and start + end times." };
      }
      if (endAt <= startAt) {
        return { success: false, message: "The end time must be after the start time." };
      }
      return requestShifts(token, role, startAt, endAt, notes);
    },
    {},
  );

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="role" className="block text-xs font-semibold text-slate-600">
          Role needed
        </label>
        <select
          name="role"
          id="role"
          defaultValue={options[0]}
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
        >
          {options.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="startAt" className="block text-xs font-semibold text-slate-600">
            Start
          </label>
          <input
            type="datetime-local"
            name="startAt"
            id="startAt"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="endAt" className="block text-xs font-semibold text-slate-600">
            End
          </label>
          <input
            type="datetime-local"
            name="endAt"
            id="endAt"
            required
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
          />
        </div>
      </div>
      <div>
        <label htmlFor="notes" className="block text-xs font-semibold text-slate-600">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          type="text"
          name="notes"
          id="notes"
          placeholder="e.g. ICU Ward 3, need experience with ventilators"
          className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-brand-500 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60 sm:w-auto"
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Request staff
      </button>
      {state.success ? (
        <p className="text-sm font-medium text-emerald-700">
          Request sent — the shift is now open and triage can pick it up.
        </p>
      ) : null}
      {state.message ? <p className="text-sm font-medium text-red-600">{state.message}</p> : null}
    </form>
  );
}