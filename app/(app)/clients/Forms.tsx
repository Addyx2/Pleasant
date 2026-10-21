"use client";

import { useActionState, useEffect, useRef } from "react";

import { CLIENT_TYPE_LABELS, CLIENT_TYPES } from "@/lib/clients";
import { buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";
import type { ActionState } from "@/app/(app)/shifts/actions";

import {
  createClientAction,
  createContactAction,
  createSiteAction,
  saveRateAction,
  updateClientAction,
} from "./actions";

const initialState: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (state.success) {
    return (
      <p role="status" className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
        {state.success}
      </p>
    );
  }
  return null;
}

/** Clears a form after a successful save so the next entry starts blank. */
function useResetOnSuccess(state: ActionState) {
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.success) ref.current?.reset();
  }, [state]);
  return ref;
}

function Field({
  id,
  label,
  className,
  ...props
}: { id: string; label: string; className?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className={className}>
      <label className={labelClass} htmlFor={id}>
        {label}
      </label>
      <input id={id} name={id} className={`${inputClass} mt-1`} {...props} />
    </div>
  );
}

export interface ClientFormValues {
  id: string;
  name: string;
  type: string;
  address: string | null;
  postcode: string | null;
  phone: string | null;
  email: string | null;
  vatNumber: string | null;
  companyNo: string | null;
  cqcLocationId: string | null;
  frameworkRef: string | null;
  paymentTermsDays: number;
  status: string;
  notes: string | null;
}

export function ClientForm({ client }: { client?: ClientFormValues }) {
  const [state, formAction, pending] = useActionState(
    client ? updateClientAction : createClientAction,
    initialState,
  );
  const v = (value: string | null | undefined) => value ?? "";

  return (
    <form action={formAction} className="space-y-4">
      {client ? <input type="hidden" name="clientId" value={client.id} /> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          id="name"
          label="Organisation name"
          required
          defaultValue={v(client?.name)}
          placeholder="Meadow View Care Home"
          className="sm:col-span-2"
        />
        <div>
          <label className={labelClass} htmlFor="type">
            Type
          </label>
          <select id="type" name="type" defaultValue={client?.type ?? "CARE_HOME"} className={`${inputClass} mt-1`}>
            {CLIENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {CLIENT_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        {client ? (
          <div>
            <label className={labelClass} htmlFor="status">
              Status
            </label>
            <select id="status" name="status" defaultValue={client.status} className={`${inputClass} mt-1`}>
              <option value="ACTIVE">Active</option>
              <option value="PAUSED">On hold</option>
              <option value="DISCHARGED">Former client</option>
            </select>
          </div>
        ) : (
          <Field id="phone" label="Main phone" defaultValue="" />
        )}
        <Field id="address" label="Address" defaultValue={v(client?.address)} className="sm:col-span-2" />
        <Field id="postcode" label="Postcode" defaultValue={v(client?.postcode)} />
        <Field id="email" label="Invoice email" type="email" defaultValue={v(client?.email)} placeholder="accounts@meadowview.co.uk" />
        {client ? <Field id="phone" label="Main phone" defaultValue={v(client.phone)} /> : null}
        <Field
          id="paymentTermsDays"
          label="Payment terms (days)"
          type="number"
          min={0}
          max={180}
          defaultValue={String(client?.paymentTermsDays ?? 30)}
        />
      </div>

      <details className="group rounded-lg border border-slate-200 px-4 py-3" open={!!client}>
        <summary className="cursor-pointer text-sm font-medium text-slate-700">
          Billing &amp; compliance details
        </summary>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field id="vatNumber" label="VAT number" defaultValue={v(client?.vatNumber)} />
          <Field id="companyNo" label="Company number" defaultValue={v(client?.companyNo)} />
          <Field id="cqcLocationId" label="CQC location ID" defaultValue={v(client?.cqcLocationId)} placeholder="1-123456789" />
          <Field id="frameworkRef" label="Framework / PO reference" defaultValue={v(client?.frameworkRef)} />
          <Field id="notes" label="Notes" defaultValue={v(client?.notes)} className="sm:col-span-2" />
        </div>
      </details>

      <Feedback state={state} />
      <button type="submit" disabled={pending} className={buttonClass}>
        {pending ? "Saving…" : client ? "Save details" : "Add client"}
      </button>
    </form>
  );
}

export function SiteForm({ clientId, noun }: { clientId: string; noun: string }) {
  const [state, formAction, pending] = useActionState(createSiteAction, initialState);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="name" label={`${noun[0].toUpperCase()}${noun.slice(1)} name`} required placeholder={noun === "branch" ? "North Leeds branch" : "Rowan Unit (dementia)"} />
        <Field id="postcode" label="Postcode (if different)" />
        <Field id="address" label="Address (if different)" className="sm:col-span-2" />
        <Field id="notes" label="Arrival notes" placeholder="Report to nurse in charge; parking at rear" className="sm:col-span-2" />
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={subtleButtonClass}>
        {pending ? "Adding…" : `Add ${noun}`}
      </button>
    </form>
  );
}

export function ContactForm({ clientId }: { clientId: string }) {
  const [state, formAction, pending] = useActionState(createContactAction, initialState);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="name" label="Name" required />
        <Field id="jobTitle" label="Job title" placeholder="Home Manager" />
        <Field id="email" label="Email" type="email" />
        <Field id="phone" label="Phone" />
      </div>
      <div className="flex flex-wrap gap-4 text-sm text-slate-700">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isSignatory" className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
          Can sign timesheets
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="isAccounts" className="h-4 w-4 rounded border-slate-300 accent-brand-600" />
          Receives invoices
        </label>
      </div>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={subtleButtonClass}>
        {pending ? "Adding…" : "Add contact"}
      </button>
    </form>
  );
}

export function RateForm({
  clientId,
  sites,
  noun,
}: {
  clientId: string;
  sites: { id: string; name: string }[];
  noun: string;
}) {
  const [state, formAction, pending] = useActionState(saveRateAction, initialState);
  const ref = useResetOnSuccess(state);
  return (
    <form ref={ref} action={formAction} className="space-y-3">
      <input type="hidden" name="clientId" value={clientId} />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field id="role" label="Role" required placeholder="Care Assistant" list="rate-roles" />
        <datalist id="rate-roles">
          <option value="Care Assistant" />
          <option value="Senior Care Assistant" />
          <option value="Support Worker" />
          <option value="Registered Nurse" />
          <option value="Domestic" />
          <option value="Cook" />
        </datalist>
        <div>
          <label className={labelClass} htmlFor="siteId">
            Applies to
          </label>
          <select id="siteId" name="siteId" defaultValue="" className={`${inputClass} mt-1`}>
            <option value="">Whole client</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} only
              </option>
            ))}
          </select>
        </div>
        <Field id="dayRate" label="Day £/hr" type="number" step="0.01" min="0" required />
        <Field id="nightRate" label="Night £/hr" type="number" step="0.01" min="0" placeholder="= day" />
        <Field id="weekendRate" label="Weekend £/hr" type="number" step="0.01" min="0" placeholder="= day" />
        <Field id="bankHolidayRate" label="Bank holiday £/hr" type="number" step="0.01" min="0" placeholder="= weekend" />
        <Field id="sleepInCharge" label="Sleep-in charge (£ flat)" type="number" step="0.01" min="0" placeholder="= carer allowance" />
      </div>
      <p className="text-xs text-slate-500">
        Blank premium rates fall back to the day rate. The sleep-in charge is what the client pays
        per sleep-in; the carer&apos;s allowance is set on the shift. Saving a role that already has a line for the
        same {noun} updates it.
      </p>
      <Feedback state={state} />
      <button type="submit" disabled={pending} className={subtleButtonClass}>
        {pending ? "Saving…" : "Save rate"}
      </button>
    </form>
  );
}
