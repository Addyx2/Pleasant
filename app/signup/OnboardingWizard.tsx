"use client";

import { useEffect, useState } from "react";
import { useActionState } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { createAgencyAction, importStaffAction, type CreateAgencyState, type ImportStaffState } from "./actions";

const STEPS = ["Agency", "Staff", "Done"];

const initialAgencyState: CreateAgencyState = {};
const initialImportState: ImportStaffState = {};

export default function OnboardingWizard({
  startedWithSession = false,
}: {
  startedWithSession?: boolean;
}) {
  const [step, setStep] = useState(startedWithSession ? 1 : 0);
  const [agencyState, agencyAction, agencyPending] = useActionState(
    createAgencyAction,
    initialAgencyState,
  );
  const [importState, importAction, importPending] = useActionState(importStaffAction, initialImportState);

  useEffect(() => {
    if (agencyState.ok && step === 0) setStep(1);
  }, [agencyState.ok, step]);

  useEffect(() => {
    if (importState.ok && step === 1) setStep(2);
  }, [importState.ok, step]);

  const done = step === 2;

  return (
    <div className="mt-8">
      <ol className="flex items-center justify-center gap-2">
        {STEPS.map((label, index) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                index < step
                  ? "bg-brand-600 text-white"
                  : index === step
                    ? "border border-brand-600 text-brand-700"
                    : "border border-slate-300 text-slate-400"
              }`}
            >
              {index < step ? <Check className="h-4 w-4" /> : index + 1}
            </span>
            {index < STEPS.length - 1 ? <span className="h-px w-8 bg-slate-300" /> : null}
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <form action={agencyAction} className="space-y-4">
          <div>
            <label htmlFor="agencyName" className="block text-sm font-medium text-slate-700">
              Agency name
            </label>
            <input
              id="agencyName"
              name="agencyName"
              required
              placeholder="e.g. Fernley Homecare"
              defaultValue={agencyState.values?.agencyName ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="firstName" className="block text-sm font-medium text-slate-700">
                Your first name
              </label>
              <input
                id="firstName"
                name="firstName"
                required
                defaultValue={agencyState.values?.firstName ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
            <div>
              <label htmlFor="lastName" className="block text-sm font-medium text-slate-700">
                Your last name
              </label>
              <input
                id="lastName"
                name="lastName"
                required
                defaultValue={agencyState.values?.lastName ?? ""}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700">
              Work email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="username"
              required
              defaultValue={agencyState.values?.email ?? ""}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              placeholder="At least 8 characters"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
          </div>

          {agencyState.error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{agencyState.error}</p>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900">
              Already have an account?
            </Link>
            <button
              type="submit"
              disabled={agencyPending}
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >
              {agencyPending ? "Creating…" : "Create your account"} <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </form>
      ) : null}

      {step === 1 ? (
        <form action={importAction} className="space-y-4">
          <div>
            <label htmlFor="csv" className="block text-sm font-medium text-slate-700">
              Paste your carers (CSV)
            </label>
            <textarea
              id="csv"
              name="csv"
              rows={8}
              spellCheck={false}
              placeholder={`firstName,lastName,email,role,rate\nGrace,Miller,grace@agency.co.uk,Care Assistant,13.90`}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
            />
            <p className="mt-2 text-xs text-slate-500">
              Columns: <code className="text-slate-700">firstName,lastName,email,role,rate</code>.
              Optional: <code className="text-slate-700">ni,taxCode,band,night,weekend</code>. Rate
              defaults to 0 if blank.
            </p>
          </div>

          {importState.ok ? (
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm font-medium text-brand-800">
              {importState.imported} carer{importState.imported === 1 ? "" : "s"} added.
            </p>
          ) : null}

          {importState.errors && importState.errors.length > 0 ? (
            <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              <p className="font-medium">Rows skipped</p>
              <ul className="mt-1 list-inside list-disc text-xs">
                {importState.errors.slice(0, 5).map((error) => (
                  <li key={error.line}>
                    Line {error.line || "—"}: {error.message}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={() => setStep(0)}
              className="text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Back
            </button>
            <div className="flex items-center gap-3">
              <Link
                href="/dashboard"
                className="text-sm font-medium text-slate-600 hover:text-slate-900"
              >
                Add staff later
              </Link>
              <button
                type="submit"
                disabled={importPending}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {importPending ? "Importing…" : "Import carers"} <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </form>
      ) : null}

      {done ? (
        <div className="text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-100 text-brand-700 mx-auto">
            <Check className="h-7 w-7" />
          </span>
          <h2 className="mt-4 text-xl font-semibold tracking-tight text-slate-900">
            {importState.ok
              ? `Your agency is live with ${importState.imported} carer${importState.imported === 1 ? "" : "s"}.`
              : "Your agency is live."}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Schedule your first shift, or run the Q4 pilot tour from your dashboard.
          </p>
          <Link
            href="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Open your dashboard <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : null}
    </div>
  );
}