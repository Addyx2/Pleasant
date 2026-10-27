import { ElementScreen } from "@/components/ElementScreen";
import { requireInstalledAddon } from "@/lib/addons-guard";

export const metadata = { title: "Peak" };
export const dynamic = "force-dynamic";

export default async function PeakPage() {
  const { user, installationId } = await requireInstalledAddon("PEAK");
  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">Peak</h1>
        <p className="mt-1.5 text-sm text-slate-500">Points for completed shifts, on-time clock-ins and praise. Approved cash-outs are added to the carer&apos;s next payslip.</p>
      </div>
      <ElementScreen installationId={installationId} title="Peak" user={{ id: user.id, name: `${user.firstName} ${user.lastName}`, role: "manager" }} />
    </div>
  );
}
