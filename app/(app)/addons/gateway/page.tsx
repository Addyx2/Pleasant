import { Headset, PhoneCall, CalendarCheck, ShieldCheck } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { Badge, Card, IconTile, PageHeader } from "@/components/ui";

export const metadata = { title: "Gateway" };

export default async function GatewayAddonPage() {
  await requireUser();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Gateway"
        description="The always-on contact centre that answers every inbound call."
        action={<Badge tone="green">AVAILABLE</Badge>}
      />

      <div className="grid gap-5 sm:grid-cols-3">
        <Card className="p-5">
          <IconTile icon={PhoneCall} tone="brand" />
          <p className="mt-3 font-display text-base font-bold text-slate-900">Answer every call</p>
          <p className="mt-1 text-sm text-slate-500">
            Runs 24/7 — no missed enquiries, every interaction logged straight into Pleasant.
          </p>
        </Card>
        <Card className="p-5">
          <IconTile icon={CalendarCheck} tone="green" />
          <p className="mt-3 font-display text-base font-bold text-slate-900">Book the assessment</p>
          <p className="mt-1 text-sm text-slate-500">
            Qualifies callers and books the next-step meeting with the right person.
          </p>
        </Card>
        <Card className="p-5">
          <IconTile icon={ShieldCheck} tone="amber" />
          <p className="mt-3 font-display text-base font-bold text-slate-900">Audit-grade logs</p>
          <p className="mt-1 text-sm text-slate-500">
            Full call records and follow-up state kept in a compliance-ready audit trail.
          </p>
        </Card>
      </div>

      <Card className="border-dashed p-6">
        <div className="flex items-center gap-3">
          <Headset className="h-5 w-5 shrink-0 text-slate-400" />
          <p className="text-sm text-slate-500">
            Gateway is provisioned per agency. Contact your account manager or book a demo to enable it.
          </p>
        </div>
      </Card>
    </div>
  );
}