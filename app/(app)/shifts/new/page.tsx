import Link from "next/link";

import { requireOps } from "@/lib/auth";
import { clientName, siteNoun, toRateCardEntry } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { NewShiftForm } from "../NewShiftForm";

export const metadata = { title: "New shift" };
export const dynamic = "force-dynamic";

export default async function NewShiftPage({
  searchParams,
}: {
  searchParams: Promise<{ clientId?: string }>;
}) {
  const user = await requireOps();
  const { clientId } = await searchParams;

  const [clients, sites, staff] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      include: { rates: true },
      orderBy: { name: "asc" },
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
        description="Book cover for a client. The charge rate comes from their rate card unless you override it."
        action={
          <Link href="/shifts" className="text-sm font-medium text-brand-700 hover:underline">
            Back to shifts
          </Link>
        }
      />
      <Card className="p-6">
        <NewShiftForm
          defaultClientId={clientId}
          clients={clients.map((c) => ({
            id: c.id,
            label: clientName(c),
            rates: c.rates.map(toRateCardEntry),
            unitNoun: siteNoun(c.type),
          }))}
          sites={sites.map((s) => ({ id: s.id, label: s.name, clientId: s.clientId }))}
          staff={staff.map((s) => ({
            id: s.id,
            label: `${s.firstName} ${s.lastName} · ${s.jobTitle}`,
          }))}
        />
      </Card>
    </div>
  );
}
