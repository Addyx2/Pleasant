import { Sparkles, Award, Gift, Wallet, PiggyBank } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { Badge, Card, IconTile, PageHeader } from "@/components/ui";

export const metadata = { title: "Peak" };

export default async function PeakAddonPage() {
  await requireUser();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Peak"
        description="Recognition that pays — points for shifts, punctuality, and praise."
        action={<Badge tone="green">AVAILABLE</Badge>}
      />

      <div className="grid gap-5">
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <IconTile icon={Award} tone="brand" />
            <div>
              <p className="font-display text-base font-bold text-slate-900">Earn</p>
              <p className="mt-1 text-sm text-slate-500">
                Carers earn Cashable Points for worked shifts, on-time arrivals, and praise from coordinators.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <IconTile icon={Gift} tone="green" />
            <div>
              <p className="font-display text-base font-bold text-slate-900">Spend</p>
              <p className="mt-1 text-sm text-slate-500">
                Points cash out to bank, or convert to perks — no compliance constraint on benefits.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <IconTile icon={Wallet} tone="amber" />
            <div>
              <p className="font-display text-base font-bold text-slate-900">Card issuing</p>
              <p className="mt-1 text-sm text-slate-500">
                Physical and virtual cashable cards issued straight from approved timesheets.
              </p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-start gap-4">
            <IconTile icon={PiggyBank} tone="slate" />
            <div>
              <p className="font-display text-base font-bold text-slate-900">Ledger</p>
              <p className="mt-1 text-sm text-slate-500">
                Per-worker points ledger, reconciled against the payroll run — always auditable.
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="border-dashed p-6">
        <div className="flex items-center gap-3">
          <Sparkles className="h-5 w-5 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-500">
            Peak plugs into approved timesheets to award points automatically. Contact your account manager to enable it.
          </p>
        </div>
      </Card>
    </div>
  );
}