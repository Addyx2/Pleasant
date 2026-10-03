import { requireInstalledAddon } from "@/lib/addons-guard";

export const metadata = { title: "Peak" };

export default async function PeakAddonPage() {
  await requireInstalledAddon("PEAK");

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
            Peak
          </h1>
          <p className="mt-1.5 text-sm text-slate-500">
            Recognition that pays — points for shifts, punctuality, and praise.
          </p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="font-display text-base font-bold text-slate-900">Earn</p>
          <p className="mt-1 text-sm text-slate-500">
            Carers earn Cashable Points for worked shifts, on-time arrivals, and praise from coordinators.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="font-display text-base font-bold text-slate-900">Spend</p>
          <p className="mt-1 text-sm text-slate-500">
            Points cash out to bank, or convert to perks — no compliance constraint on benefits.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="font-display text-base font-bold text-slate-900">Card issuing</p>
          <p className="mt-1 text-sm text-slate-500">
            Physical and virtual cashable cards issued straight from approved timesheets.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-card">
          <p className="font-display text-base font-bold text-slate-900">Ledger</p>
          <p className="mt-1 text-sm text-slate-500">
            Per-worker points ledger, reconciled against the payroll run — always auditable.
          </p>
        </div>
      </div>
    </div>
  );
}