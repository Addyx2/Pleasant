"use client";

import { useActionState, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { resolveChargeRate, type RateCardEntry } from "@/lib/clients";
import { formatCurrency } from "@/lib/utils";
import { createShiftAction, type ActionState } from "./actions";
import { buttonClass, inputClass, labelClass } from "@/components/ui";

const initialState: ActionState = {};

interface Option {
  id: string;
  label: string;
}

export interface ShiftFormClient extends Option {
  rates: RateCardEntry[];
  unitNoun: string;
}

export interface ShiftFormSite extends Option {
  clientId: string | null;
}

const BAND_LABELS = { DAY: "day", NIGHT: "night", WEEKEND: "weekend", BANK_HOLIDAY: "bank holiday" } as const;

export function NewShiftForm({
  clients,
  sites,
  staff,
  defaultClientId,
}: {
  clients: ShiftFormClient[];
  sites: ShiftFormSite[];
  staff: Option[];
  defaultClientId?: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(async (prev: ActionState, formData: FormData) => {
    const result = await createShiftAction(prev, formData);
    if (result.success) router.push("/shifts");
    return result;
  }, initialState);

  const [clientId, setClientId] = useState(
    clients.some((c) => c.id === defaultClientId) ? defaultClientId! : "",
  );
  const [siteId, setSiteId] = useState("");
  const [role, setRole] = useState("");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [isSleepIn, setIsSleepIn] = useState(false);

  const client = clients.find((c) => c.id === clientId);
  const clientSites = sites.filter((s) => s.clientId === clientId);
  const unitNoun = client?.unitNoun ?? "unit";
  const roles = useMemo(() => [...new Set(client?.rates.map((r) => r.role) ?? [])], [client]);

  const resolved = useMemo(() => {
    if (!client || !role || !startAt || !endAt || isSleepIn) return null;
    const start = new Date(startAt);
    const end = new Date(endAt);
    if (!(end > start)) return null;
    return resolveChargeRate(client.rates, { role, siteId: siteId || null, startAt: start, endAt: end });
  }, [client, role, siteId, startAt, endAt, isSleepIn]);

  const rateHint = isSleepIn
    ? "Sleep-ins are billed at the flat allowance below."
    : !client
      ? "Choose a client to use their rate card."
      : !role
        ? "Enter the role to look up the rate card."
        : resolved
          ? `Leave blank to charge ${formatCurrency(resolved.rate)}/hr — ${BAND_LABELS[resolved.band]} rate for ${resolved.entry.role}${resolved.entry.siteId ? ` (${unitNoun} rate)` : ""}.`
          : startAt && endAt
            ? `No ${role} rate on this client's card — enter one here or add it to the rate card.`
            : "Set the times to see the rate-card charge.";

  return (
    <form action={formAction} className="grid gap-5 sm:grid-cols-2">
      <div>
        <label className={labelClass} htmlFor="clientId">Client</label>
        <select
          id="clientId"
          name="clientId"
          className={inputClass}
          value={clientId}
          onChange={(e) => {
            setClientId(e.target.value);
            setSiteId("");
          }}
        >
          <option value="">No client</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="siteId">{unitNoun[0].toUpperCase() + unitNoun.slice(1)}</label>
        <select
          id="siteId"
          name="siteId"
          className={inputClass}
          value={siteId}
          onChange={(e) => setSiteId(e.target.value)}
          disabled={!clientId || clientSites.length === 0}
        >
          <option value="">{clientId && clientSites.length === 0 ? `No ${unitNoun}s set up` : `Whole site / not specified`}</option>
          {clientSites.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
        </select>
      </div>

      <div>
        <label className={labelClass} htmlFor="role">Role required</label>
        <input
          id="role"
          name="role"
          required
          className={inputClass}
          placeholder="Care Assistant"
          list="shift-roles"
          value={role}
          onChange={(e) => setRole(e.target.value)}
        />
        <datalist id="shift-roles">
          {roles.map((r) => (
            <option key={r} value={r} />
          ))}
        </datalist>
      </div>

      <div>
        <label className={labelClass} htmlFor="title">Shift title <span className="font-normal text-slate-400">(optional)</span></label>
        <input id="title" name="title" className={inputClass} placeholder={[role || "Care Assistant", clientSites.find((s) => s.id === siteId)?.label].filter(Boolean).join(" — ")} />
      </div>

      <div>
        <label className={labelClass} htmlFor="startAt">Starts</label>
        <input id="startAt" name="startAt" type="datetime-local" required className={inputClass} value={startAt} onChange={(e) => setStartAt(e.target.value)} />
      </div>

      <div>
        <label className={labelClass} htmlFor="endAt">Ends</label>
        <input id="endAt" name="endAt" type="datetime-local" required className={inputClass} value={endAt} onChange={(e) => setEndAt(e.target.value)} />
      </div>

      <div>
        <label className={labelClass} htmlFor="chargeRate">Charge rate to client (£/hr)</label>
        <input
          id="chargeRate"
          name="chargeRate"
          type="number"
          step="0.01"
          min="0"
          className={inputClass}
          placeholder={resolved ? resolved.rate.toFixed(2) : "From rate card"}
          disabled={isSleepIn}
        />
        <p className="mt-1 text-xs text-slate-500">{rateHint}</p>
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

      <div className="flex items-end gap-4">
        <label htmlFor="isSleepIn" className="flex items-center gap-2 pb-2.5 text-sm text-slate-700">
          <input
            id="isSleepIn"
            name="isSleepIn"
            type="checkbox"
            className="h-4 w-4 rounded border-slate-300"
            checked={isSleepIn}
            onChange={(e) => setIsSleepIn(e.target.checked)}
          />
          Sleep-in
        </label>
        {isSleepIn ? (
          <div className="flex-1">
            <label className={labelClass} htmlFor="sleepInRate">Flat allowance (£)</label>
            <input id="sleepInRate" name="sleepInRate" type="number" step="0.01" min="0" required className={inputClass} />
          </div>
        ) : null}
      </div>

      <div className="sm:col-span-2">
        <label className={labelClass} htmlFor="notes">Notes for the carer</label>
        <textarea id="notes" name="notes" rows={3} className={inputClass} placeholder="Report to the nurse in charge; parking at the rear" />
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
