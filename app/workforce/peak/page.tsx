import { redirect } from "next/navigation";

import { ElementScreen } from "@/components/ElementScreen";
import { requireUser } from "@/lib/auth";
import { installationFor } from "@/lib/elements";

export const metadata = { title: "Peak" };
export const dynamic = "force-dynamic";

/** A carer's own Peak points, rewards and history. */
export default async function WorkforcePeakPage() {
  const user = await requireUser();
  if (!user.staff) redirect("/workforce");
  const installationId = await installationFor(user.agencyId, "PEAK");
  if (!installationId) redirect("/workforce");
  return (
    <div className="px-4 pb-28 pt-4">
      <ElementScreen
        installationId={installationId}
        title="Your Peak points"
        className="h-[calc(100dvh-12rem)] min-h-[520px]"
        user={{ id: user.id, name: `${user.staff.firstName} ${user.staff.lastName}`, role: "member", personId: user.staff.id }}
      />
    </div>
  );
}
