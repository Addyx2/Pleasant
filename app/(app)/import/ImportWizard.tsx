"use client";

import { useActionState, useState } from "react";

import { previewImportAction, commitImportAction, type ImportResult } from "./actions";
import { buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";

const initialState: ImportResult = { ok: false, message: "" };

const TEMPLATES: { kind: "clients" | "workers" | "shifts"; label: string; columns: string; example: string }[] = [
  {
    kind: "clients",
    label: "Clients",
    columns: "First Name, Last Name, Email, Phone, Address, Postcode, Care Level, Company, VAT Number",
    example: "Jane,Hughes,jane@example.com,07700 900123,1 High St,SW1A 1AA,High,Meadow View Care Home,GB123456789",
  },
  {
    kind: "workers",
    label: "Carers",
    columns: "First Name, Last Name, Job Title, Base Rate, Engagement, Sort Code, Account Number, DBS Expiry",
    example: "Ada,Lovelace,Care Assistant,12.71,PAYE,20-00-00,12345678,12/06/2027",
  },
  {
    kind: "shifts",
    label: "Shifts",
    columns: "Date, Start, End, Title, Role, Client, Carer",
    example: "09/03/2026,07:00,15:00,Day shift,Care Assistant,Jane Hughes,Ada Lovelace",
  },
];

export function ImportWizard() {
  const [kind, setKind] = useState<"clients" | "workers" | "shifts">("clients");
  const [preview, formAction, pending] = useActionState(previewImportAction, initialState);
  const active = TEMPLATES.find((t) => t.kind === kind)!;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TEMPLATES.map((template) => (
          <button
            key={template.kind}
            type="button"
            onClick={() => setKind(template.kind)}
            className={
              kind === template.kind
                ? "rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
                : "rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {template.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Columns we look for</p>
        <p className="mt-1.5 text-sm text-slate-700">{active.columns}</p>
        <p className="mt-2 text-xs text-slate-500">
          Header names are matched loosely — <em>First name</em>, <em>FirstName</em> and <em>first_name</em> all
          work. Dates accept DD/MM/YYYY. Extra columns are ignored.
        </p>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-white p-3 text-xs text-slate-700">
          <code>{`First Name,Last Name\n${active.example.split(",").slice(0, 2).join(",")}`}</code>
        </pre>
      </div>

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="kind" value={kind} />
        <div>
          <label className={labelClass} htmlFor="file">CSV file</label>
          <input id="file" name="file" type="file" accept=".csv,text/csv" className={inputClass} />
        </div>
        <div>
          <label className={labelClass} htmlFor="paste">…or paste the rows here</label>
          <textarea
            id="paste"
            name="paste"
            rows={6}
            placeholder={`First Name,Last Name\n${active.example}`}
            className={`${inputClass} font-mono text-xs`}
          />
        </div>
        {preview.message ? (
          <p
            className={
              preview.ok
                ? "rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
                : "rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700"
            }
          >
            {preview.message}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={subtleButtonClass}>
          {pending ? "Reading…" : "Check the file"}
        </button>
      </form>

      {preview.ok && preview.sessionId ? (
        <form action={commitImportAction} className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <input type="hidden" name="sessionId" value={preview.sessionId} />
          <p className="text-sm font-semibold text-emerald-900">
            {preview.validRows} row{preview.validRows === 1 ? "" : "s"} ready to import
          </p>
          <p className="mt-1 text-sm text-emerald-800">
            Importing creates records that don&apos;t already exist. Duplicates (matched on first and last name)
            and unreadable rows are skipped, not overwritten.
          </p>
          <div className="mt-3 flex gap-2">
            <button type="submit" className={buttonClass}>
              Import rows
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}