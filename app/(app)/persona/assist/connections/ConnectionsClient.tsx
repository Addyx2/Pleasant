"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, TriangleAlert } from "lucide-react";

import { ASSIST_GROUPS } from "@/lib/assist/policy";
import { cn } from "@/lib/utils";
import { buttonClass, subtleButtonClass } from "@/components/ui";

import { saveAssistPolicyAction, sendTestEmailAction, testModelAction, type TestState } from "./actions";

export function TestButton({ kind, label }: { kind: "model" | "email"; label: string }) {
  const [state, action, pending] = useActionState<TestState>(kind === "model" ? testModelAction : sendTestEmailAction, {});
  return (
    <form action={action} className="space-y-2">
      <button type="submit" disabled={pending} className={cn(subtleButtonClass, "py-1.5 text-xs")}>
        {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
        {pending ? "Checking…" : label}
      </button>
      {state.message ? (
        <p className={cn("flex items-start gap-1.5 text-xs", state.ok ? "text-emerald-700" : "text-red-600")} role="status">
          {state.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          {state.message}
        </p>
      ) : null}
    </form>
  );
}

function Toggle({ name, checked, onChange, disabled, label }: { name: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label: string }) {
  return (
    <label className={cn("inline-flex items-center gap-2 text-xs font-medium", disabled ? "text-slate-300" : "text-slate-600")}>
      <input type="checkbox" name={name} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden="true"
        className={cn(
          "relative h-5 w-9 rounded-full transition peer-focus-visible:ring-2 peer-focus-visible:ring-brand-500 peer-focus-visible:ring-offset-2",
          checked && !disabled ? "bg-brand-600" : "bg-slate-200",
        )}
      >
        <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition", checked && !disabled ? "left-[18px]" : "left-0.5")} />
      </span>
      {label}
    </label>
  );
}

export function PolicyForm({ disabled, editable }: { disabled: string[]; editable: boolean }) {
  const [state, setState] = useState(() =>
    Object.fromEntries(
      ASSIST_GROUPS.map((g) => [g.key, { read: !disabled.includes(`${g.key}:read`), write: !disabled.includes(`${g.key}:write`) }]),
    ) as Record<string, { read: boolean; write: boolean }>,
  );
  const [saved, setSaved] = useState(false);

  return (
    <form
      action={async (formData) => {
        await saveAssistPolicyAction(formData);
        setSaved(true);
      }}
      onChange={() => setSaved(false)}
    >
      <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
        {ASSIST_GROUPS.map((g) => {
          const s = state[g.key];
          return (
            <li key={g.key} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">
                  {g.label}
                  {g.adminOnly ? <span className="ml-2 text-[11px] font-normal text-slate-400">Admins only</span> : null}
                </p>
                <p className="text-xs text-slate-500">{g.description}</p>
              </div>
              <div className="flex shrink-0 gap-5">
                <Toggle
                  name={`${g.key}:read`}
                  label="Read"
                  checked={s.read}
                  disabled={!editable}
                  onChange={(v) => setState({ ...state, [g.key]: { read: v, write: v ? s.write : false } })}
                />
                <Toggle
                  name={`${g.key}:write`}
                  label="Change"
                  checked={s.read && s.write}
                  disabled={!editable || !s.read}
                  onChange={(v) => setState({ ...state, [g.key]: { ...s, write: v } })}
                />
              </div>
            </li>
          );
        })}
      </ul>
      {editable ? (
        <div className="mt-3 flex items-center gap-3">
          <button type="submit" className={buttonClass}>Save access</button>
          {saved ? (
            <span className="inline-flex items-center gap-1 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Saved
            </span>
          ) : null}
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500">Only admins can change what Assist can access.</p>
      )}
    </form>
  );
}
