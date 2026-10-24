import Link from "next/link";
import { Building2, ChevronRight } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { CLIENT_STATUS, CLIENT_TYPE_LABELS, clientName, siteNoun, type ClientTypeKey } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { cn, formatCurrency } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader, Td, Th } from "@/components/ui";

import { ClientForm } from "./Forms";

export const metadata = { title: "Clients" };
export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const user = await requireOps();
  const { view } = await searchParams;
  const showAll = view === "all";
  const isAdmin = user.role === "ADMIN";

  const [clients, outstanding] = await Promise.all([
    prisma.client.findMany({
      where: { agencyId: user.agencyId, ...(showAll ? {} : { status: { not: "DISCHARGED" } }) },
      include: {
        _count: {
          select: {
            sites: true,
            contacts: { where: { isSignatory: true } },
            shifts: { where: { startAt: { gte: new Date() }, status: { not: "CANCELLED" } } },
          },
        },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
    }),
    isAdmin
      ? prisma.invoice.groupBy({
          by: ["clientId"],
          where: { agencyId: user.agencyId, status: "ISSUED" },
          _sum: { grandTotal: true },
        })
      : Promise.resolve([]),
  ]);
  const owed = new Map(outstanding.map((row) => [row.clientId, Number(row._sum.grandTotal ?? 0)]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clients"
        description="The care homes and domiciliary care providers you supply, with their units, signatories and charge rates."
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-slate-900">
              {showAll ? "All clients" : "Current clients"}
            </h2>
            <div className="flex gap-1.5 text-xs">
              {[
                { href: "/clients", label: "Current", active: !showAll },
                { href: "/clients?view=all", label: "Include former", active: showAll },
              ].map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={cn(
                    "rounded-full px-3 py-1 font-medium",
                    tab.active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200",
                  )}
                >
                  {tab.label}
                </Link>
              ))}
            </div>
          </div>

          {clients.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No clients yet"
                description="Add the first care home or domiciliary provider you supply using the form."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead>
                  <tr>
                    <Th>Client</Th>
                    <Th>Units</Th>
                    <Th>Signatories</Th>
                    <Th>Upcoming shifts</Th>
                    {isAdmin ? <Th className="text-right">Owed</Th> : null}
                    <Th>Status</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {clients.map((client) => {
                    const status = CLIENT_STATUS[client.status] ?? CLIENT_STATUS.ACTIVE;
                    const balance = owed.get(client.id) ?? 0;
                    return (
                      <tr key={client.id} className="group relative transition hover:bg-slate-50/70">
                        <Td className="min-w-[13rem]">
                          <Link
                            href={`/clients/${client.id}`}
                            className="font-medium text-slate-900 after:absolute after:inset-0 group-hover:text-brand-700"
                          >
                            {clientName(client)}
                          </Link>
                          <p className="text-xs text-slate-500">
                            {CLIENT_TYPE_LABELS[client.type as ClientTypeKey]}
                            {client.postcode ? ` · ${client.postcode}` : ""}
                          </p>
                        </Td>
                        <Td className="tabular whitespace-nowrap">
                          {client._count.sites}{" "}
                          <span className="text-xs text-slate-400">{siteNoun(client.type, client._count.sites !== 1)}</span>
                        </Td>
                        <Td>
                          {client._count.contacts > 0 ? (
                            <span className="tabular">{client._count.contacts}</span>
                          ) : (
                            <Badge tone="amber">None</Badge>
                          )}
                        </Td>
                        <Td className="tabular">{client._count.shifts}</Td>
                        {isAdmin ? (
                          <Td className={cn("tabular text-right", balance > 0 ? "font-medium text-slate-900" : "text-slate-400")}>
                            {balance > 0 ? formatCurrency(balance) : "—"}
                          </Td>
                        ) : null}
                        <Td>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </Td>
                        <Td className="w-8 text-slate-300 group-hover:text-slate-500">
                          <ChevronRight className="h-4 w-4" />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="h-fit p-5">
          <div className="flex items-center gap-2.5">
            <Building2 className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Add a client</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Add units, signatories and the rate card on the next screen.
          </p>
          <div className="mt-4">
            <ClientForm />
          </div>
        </Card>
      </div>
    </div>
  );
}
