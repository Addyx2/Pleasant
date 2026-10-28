import { Sparkles } from "lucide-react";

import { ElementScreen } from "@/components/ElementScreen";
import { requireUser } from "@/lib/auth";
import { installationFor } from "@/lib/elements";

export const metadata = { title: "Peak" };
export const dynamic = "force-dynamic";

export default async function WorkforcePeakPage() {
  const user = await requireUser();
  const installationId = user.staff ? await installationFor(user.agencyId, "PEAK") : null;

  if (installationId && user.staff) {
    return (
      <div className="px-1 pb-28 pt-2">
        <ElementScreen
          installationId={installationId}
          title="Your Peak points"
          className="h-[calc(100dvh-12rem)] min-h-[520px]"
          user={{
            id: user.id,
            name: `${user.staff.firstName} ${user.staff.lastName}`,
            role: "member",
            personId: user.staff.id,
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-3xl border border-slate-200 bg-white p-6 text-center">
      <Sparkles className="mx-auto h-8 w-8 text-brand-600" />
      <h1 className="text-lg font-bold tracking-tight text-slate-900">Peak isn&apos;t switched on yet</h1>
      <p className="text-sm text-slate-600">
        When {user.agency.name} switches on Peak, you&apos;ll earn points for your shifts and for clocking in on time, get badges when your work is recognised, and see offers from Aultrum&apos;s partners here.
      </p>
    </div>
  );
}
