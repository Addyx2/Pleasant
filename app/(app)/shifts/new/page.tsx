import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { NewShiftForm } from "../NewShiftForm";

export const metadata = { title: "New shift" };
export const dynamic = "force-dynamic";

export default async function NewShiftPage() {
  const user = await requireUser();

  const [clients, sites, staff] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
    }),
    prisma.site.findMany({ where: { agencyId: user.agencyId }, orderBy: { name: "asc" } }),
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
    }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Create a shift"
        description="Schedule a care visit and optionally assign a carer right away."
        action={
          <Link href="/shifts" className="text-sm font-medium text-brand-700 hover:underline">
            Back to shifts
          </Link>
        }
      />
      <Card className="p-6">
        <NewShiftForm
          clients={clients.map((c) => ({ id: c.id, label: `${c.firstName} ${c.lastName}` }))}
          sites={sites.map((s) => ({ id: s.id, label: s.name }))}
          staff={staff.map((s) => ({
            id: s.id,
            label: `${s.firstName} ${s.lastName} · ${s.jobTitle}`,
          }))}
        />
      </Card>
    </div>
  );
}
