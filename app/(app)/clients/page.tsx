import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { NewClientForm, NewSiteForm } from "./Forms";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage() {
  const user = await requireUser();

  const [clients, sites] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId: user.agencyId },
      include: { _count: { select: { shifts: true } } },
      orderBy: { lastName: "asc" },
    }),
    prisma.site.findMany({ where: { agencyId: user.agencyId }, orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients & sites"
        description="The people you care for and the places your carers visit."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="overflow-x-auto p-0 lg:col-span-2">
          {clients.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No clients yet" description="Add a client using the form." />
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50">
                <tr>
                  <Th>Client</Th>
                  <Th>Care level</Th>
                  <Th>Postcode</Th>
                  <Th>Shifts</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {clients.map((client) => (
                  <tr key={client.id} className="hover:bg-slate-50">
                    <Td>
                      <span className="font-medium text-slate-900">
                        {client.firstName} {client.lastName}
                      </span>
                      <p className="text-xs text-slate-500">{client.phone ?? "—"}</p>
                    </Td>
                    <Td>{client.careLevel ?? "—"}</Td>
                    <Td>{client.postcode ?? "—"}</Td>
                    <Td>{client._count.shifts}</Td>
                    <Td>
                      <StatusBadge status={client.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Add a client</h2>
            <div className="mt-4">
              <NewClientForm />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-slate-900">Sites</h2>
            {sites.length > 0 ? (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {sites.map((site) => (
                  <li key={site.id} className="rounded-lg bg-slate-50 px-3 py-2">
                    <p className="font-medium">{site.name}</p>
                    <p className="text-xs text-slate-500">
                      {[site.address, site.postcode].filter(Boolean).join(", ") || "No address"}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">No sites yet.</p>
            )}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <NewSiteForm />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
