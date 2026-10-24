"use client";

import { useActionState, useRef, useState } from "react";
import { Check, Copy, Mail, UserPlus } from "lucide-react";

import { buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";
import { ROLE_DESCRIPTIONS } from "@/lib/permissions";

import {
  changeRoleAction,
  inviteTeamMemberAction,
  resendInviteAction,
  type TeamInviteState,
} from "./actions";

function InviteResult({ state }: { state: TeamInviteState }) {
  const [copied, setCopied] = useState(false);
  if (state.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
        {state.error}
      </p>
    );
  }
  if (!state.ok) return null;
  return (
    <div className="space-y-2" role="status">
      <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-800">
        {state.delivered
          ? `Invite sent to ${state.email}.`
          : `Email delivery isn't configured — copy this one-time link and send it to ${state.email}.`}
      </p>
      {state.link ? (
        <div className="flex items-center gap-2">
          <code className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
            {state.link}
          </code>
          <button
            type="button"
            className={subtleButtonClass}
            onClick={async () => {
              await navigator.clipboard.writeText(state.link!);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function InviteMemberForm() {
  const [state, formAction, pending] = useActionState(inviteTeamMemberAction, {});
  const [role, setRole] = useState<"MANAGER" | "ADMIN">("MANAGER");

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className={labelClass} htmlFor="firstName">First name</label>
          <input id="firstName" name="firstName" required className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="lastName">Last name</label>
          <input id="lastName" name="lastName" required className={`${inputClass} mt-1`} />
        </div>
        <div>
          <label className={labelClass} htmlFor="email">Work email</label>
          <input id="email" name="email" type="email" required className={`${inputClass} mt-1`} />
        </div>
      </div>

      <fieldset>
        <legend className={labelClass}>Role</legend>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {(["MANAGER", "ADMIN"] as const).map((value) => (
            <label
              key={value}
              className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm transition ${
                role === value
                  ? "border-brand-500 bg-brand-50/60 ring-1 ring-brand-500"
                  : "border-slate-200 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name="role"
                value={value}
                checked={role === value}
                onChange={() => setRole(value)}
                className="mt-0.5 accent-brand-600"
              />
              <span>
                <span className="block font-semibold text-slate-900">
                  {value === "ADMIN" ? "Admin" : "Manager"}
                </span>
                <span className="block text-xs text-slate-500">{ROLE_DESCRIPTIONS[value]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <InviteResult state={state} />

      <button type="submit" disabled={pending} className={buttonClass}>
        <UserPlus className="h-4 w-4" />
        {pending ? "Sending invite…" : "Send invite"}
      </button>
    </form>
  );
}

export function RoleSelect({
  userId,
  role,
  disabled,
}: {
  userId: string;
  role: "ADMIN" | "MANAGER";
  disabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form ref={formRef} action={changeRoleAction}>
      <input type="hidden" name="userId" value={userId} />
      <select
        name="role"
        defaultValue={role}
        disabled={disabled}
        aria-label="Role"
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white py-1 pl-2 pr-7 text-xs font-medium text-slate-700 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
      >
        <option value="ADMIN">Admin</option>
        <option value="MANAGER">Manager</option>
      </select>
    </form>
  );
}

export function ResendInviteButton({ userId }: { userId: string }) {
  const [state, formAction, pending] = useActionState(resendInviteAction, {});
  return (
    <div className="space-y-2">
      <form action={formAction}>
        <input type="hidden" name="userId" value={userId} />
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-700 hover:text-brand-800 disabled:opacity-60"
        >
          <Mail className="h-3.5 w-3.5" />
          {pending ? "Sending…" : "Resend invite"}
        </button>
      </form>
      {state.ok || state.error ? <InviteResult state={state} /> : null}
    </div>
  );
}
