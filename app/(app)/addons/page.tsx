import Link from "next/link";
import { ArrowUpRight, Headset, Puzzle, Sparkles, Plus } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { Card, PageHeader, buttonClass, subtleButtonClass } from "@/components/ui";
import { getAvailableAddons } from "@/lib/addons";
import { installAddonAction, uninstallAddonAction } from "./actions";

export const metadata = { title: "Elements" };

const ICONS = {
  GATEWAY: Headset,
  PEAK: Sparkles,
};

export default async function AddonsPage({ searchParams }: { searchParams: Promise<{ error?: string; on?: string }> }) {
  const user = await requireAdmin();
  const { error, on } = await searchParams;
  const addons = await getAvailableAddons(user.agencyId);

  const installed = addons.filter((a) => a.installed);
  const available = addons.filter((a) => !a.installed);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Elements"
        description="Aultrum modules that run inside Pleasant. Switch on the ones your agency uses."
      />
      {error ? (
        <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{error.slice(0, 300)}</p>
      ) : on === "GATEWAY" || on === "PEAK" ? (
        <p role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {on === "GATEWAY"
            ? "Gateway is on. Your carers' and client contacts' numbers are being sent so it recognises them. Set its phone number and web chat in the Elements console."
            : "Peak is on. Carers earn points as they clock in on time and their timesheets are approved, and see them in the Pleasant Workers app."}
        </p>
      ) : null}

      {installed.length > 0 ? (
        <div className="space-y-4">
          <h2 className="text-sm font-semibold text-slate-700">Installed</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {installed.map((addon) => {
              const Icon = ICONS[addon.key] ?? Puzzle;
              return (
                <div
                  key={addon.key}
                  className="group rounded-xl border border-slate-200 bg-white p-6 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-inset ring-black/[0.04]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <form action={uninstallAddonAction}>
                      <input type="hidden" name="key" value={addon.key} />
                      <button type="submit" className={subtleButtonClass}>
                        Switch off
                      </button>
                    </form>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{addon.name}</h3>
                  <p className="mt-1.5 text-sm text-slate-500">{addon.shortDescription}</p>
                  <Link
                    href={addon.href}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition group-hover:text-slate-900"
                  >
                    Open
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Available</h2>
        {available.length === 0 ? (
          <Card className="border-dashed p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                <Puzzle className="h-5 w-5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-slate-700">Every Element is switched on</p>
                <p className="text-sm text-slate-500">There are no more Elements to add yet.</p>
              </div>
            </div>
          </Card>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {available.map((addon) => {
              const Icon = ICONS[addon.key] ?? Puzzle;
              return (
                <div key={addon.key} className="rounded-xl border border-slate-200 bg-white p-6 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-inset ring-black/[0.04]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <form action={installAddonAction}>
                      <input type="hidden" name="key" value={addon.key} />
                      <button type="submit" className={buttonClass}>
                        <Plus className="h-4 w-4" />
                        Switch on
                      </button>
                    </form>
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold text-slate-900">{addon.name}</h3>
                  <p className="mt-1.5 text-sm text-slate-500">{addon.shortDescription}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <Card className="border-dashed p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Puzzle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-700">More Elements in the works</p>
            <p className="text-sm text-slate-500">
              Compliance and Metrics are being designed. Ask your account manager for the roadmap.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}