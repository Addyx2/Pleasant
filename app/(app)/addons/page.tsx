import Link from "next/link";
import { ArrowUpRight, Headset, Puzzle, Sparkles } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Add-ons" };

const ADDONS = [
  {
    href: "/addons/gateway",
    title: "Gateway",
    icon: Headset,
    tone: "brand",
    description:
      "Always-on contact centre that answers every inbound call, qualifies enquiries, and books the assessment for you.",
    status: { label: "AVAILABLE", tone: "bg-emerald-50 text-emerald-700" },
  },
  {
    href: "/addons/peak",
    title: "Peak",
    icon: Sparkles,
    tone: "amber",
    description:
      "Recognition that pays: points for shifts, punctuality, and praise — cashed out or spent on perks.",
    status: { label: "AVAILABLE", tone: "bg-emerald-50 text-emerald-700" },
  },
];

export default async function AddonsPage() {
  await requireUser();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Add-ons Suite"
        description="Optional modules that plug into Pleasant to extend scheduling and payroll."
      />

      <div className="grid gap-5 sm:grid-cols-2">
        {ADDONS.map((addon) => (
          <Link
            key={addon.href}
            href={addon.href}
            className="group rounded-xl border border-slate-200 bg-white p-6 shadow-card transition duration-150 hover:border-slate-300 hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-slate-100 text-slate-600 ring-1 ring-inset ring-black/[0.04]">
                <addon.icon className="h-5 w-5" />
              </span>
              <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ring-black/[0.04] ${addon.status.tone}`}>
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-70" aria-hidden="true" />
                {addon.status.label}
              </span>
            </div>
            <h2 className="mt-4 font-display text-lg font-bold text-slate-900">{addon.title}</h2>
            <p className="mt-1.5 text-sm text-slate-500">{addon.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-slate-700 transition group-hover:text-slate-900">
              Open add-on
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
        ))}
      </div>

      <Card className="border-dashed p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Puzzle className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-slate-700">More add-ons in the works</p>
            <p className="text-sm text-slate-500">
              Compliance, Metrics, and Tender are being designed. Ask your account manager for the roadmap.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}