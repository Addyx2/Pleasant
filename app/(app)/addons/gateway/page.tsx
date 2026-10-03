import { requireInstalledAddon } from "@/lib/addons-guard";

export const metadata = { title: "Gateway" };

export default async function GatewayAddonPage() {
  await requireInstalledAddon("GATEWAY");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
            Gateway
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            The always-on contact centre that answers every inbound call.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="font-display text-base font-bold text-slate-900">Answer every call</p>
          <p className="mt-1 text-sm text-slate-500">
            Runs 24/7 — no missed enquiries, every interaction logged straight into Pleasant.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="mt-3 font-display text-base font-bold text-slate-900">Book the assessment</p>
          <p className="mt-1 text-sm text-slate-500">
            Qualifies callers and books the next-step meeting with the right person.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="mt-3 font-display text-base font-bold text-slate-900">Audit-grade logs</p>
          <p className="mt-1 text-sm text-slate-500">
            Full call records and follow-up state kept in a compliance-ready audit trail.
          </p>
        </div>
      </div>
    </div>
  );
}