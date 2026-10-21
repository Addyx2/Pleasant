import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgePoundSterling,
  Building2,
  CalendarClock,
  Link2,
  MapPin,
  PenLine,
  Receipt,
  Trash2,
  Users,
} from "lucide-react";

import { requireOps } from "@/lib/auth";
import { CLIENT_STATUS, CLIENT_TYPE_LABELS, clientName, siteNoun, type ClientTypeKey } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { Badge, Card, Td, Th } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { GenerateLinkButton } from "@/components/clientpoint/GenerateLinkButton";

import { deleteContactAction, deleteRateAction, deleteSiteAction, updateContactRolesAction } from "../actions";
import { ClientForm, ContactForm, RateForm, SiteForm } from "../Forms";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOps();
  const { id } = await params;
  const client = await prisma.client.findFirst({
    where: { id, agencyId: user.agencyId },
    select: { name: true, companyName: true, firstName: true, lastName: true },
  });
  return { title: client ? clientName(client) : "Client" };
}

function money(value: { toString(): string } | null) {
  return value == null ? <span className="text-slate-300">—</span> : formatCurrency(value);
}

function SectionHeader({
  icon: Icon,
  title,
  hint,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2.5">
        <Icon className="h-4 w-4 text-brand-600" />
        <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      </div>
      {hint ? <p className="mt-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function RoleToggle({ contactId, field, on, label }: { contactId: string; field: string; on: boolean; label: string }) {
  return (
    <form action={updateContactRolesAction}>
      <input type="hidden" name="contactId" value={contactId} />
      <input type="hidden" name="field" value={field} />
      <input type="hidden" name="value" value={on ? "false" : "true"} />
      <button
        type="submit"
        aria-pressed={on}
        title={on ? `Remove: ${label}` : `Make: ${label}`}
        className={
          on
            ? "rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/15"
            : "rounded-full px-2 py-0.5 text-[11px] font-medium text-slate-400 ring-1 ring-inset ring-slate-200 hover:text-slate-600"
        }
      >
        {label}
      </button>
    </form>
  );
}

export default async function ClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireOps();
  const { id } = await params;
  const isAdmin = user.role === "ADMIN";

  const client = await prisma.client.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      sites: { orderBy: { name: "asc" }, include: { _count: { select: { shifts: true } } } },
      contacts: { orderBy: [{ isSignatory: "desc" }, { name: "asc" }] },
      rates: { include: { site: { select: { name: true } } }, orderBy: [{ role: "asc" }] },
    },
  });
  if (!client) notFound();

  const now = new Date();
  const [upcoming, invoices] = await Promise.all([
    prisma.shift.findMany({
      where: { clientId: client.id, startAt: { gte: now }, status: { not: "CANCELLED" } },
      include: { staff: { select: { firstName: true, lastName: true } }, site: { select: { name: true } } },
      orderBy: { startAt: "asc" },
      take: 6,
    }),
    isAdmin
      ? prisma.invoice.findMany({
          where: { clientId: client.id, status: { in: ["ISSUED", "PAID", "DRAFT"] } },
          orderBy: { createdAt: "desc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);
  const owed = invoices.filter((i) => i.status === "ISSUED").reduce((sum, i) => sum + Number(i.grandTotal), 0);

  const status = CLIENT_STATUS[client.status] ?? CLIENT_STATUS.ACTIVE;
  const unit = siteNoun(client.type);
  const units = siteNoun(client.type, true);
  const signatories = client.contacts.filter((c) => c.isSignatory);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/clients" className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-3.5 w-3.5" /> Clients
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 sm:text-[1.65rem]">
              {clientName(client)}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <Badge tone="slate">{CLIENT_TYPE_LABELS[client.type as ClientTypeKey]}</Badge>
              <Badge tone={status.tone}>{status.label}</Badge>
              {[client.address, client.postcode].filter(Boolean).length > 0 ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" />
                  {[client.address, client.postcode].filter(Boolean).join(", ")}
                </span>
              ) : null}
              <span>· {client.paymentTermsDays}-day terms</span>
            </div>
          </div>
          <Link
            href={`/shifts/new?clientId=${client.id}`}
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-btn transition hover:bg-brand-700"
          >
            <CalendarClock className="h-4 w-4" /> New shift
          </Link>
        </div>
      </div>

      {signatories.length === 0 || client.rates.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50/60 p-4 text-sm text-amber-900">
          <p className="font-medium">Finish setting up {clientName(client)}</p>
          <ul className="mt-1 list-inside list-disc text-xs">
            {client.rates.length === 0 ? <li>Add a rate card so new shifts are charged correctly.</li> : null}
            {signatories.length === 0 ? <li>Add a contact who can sign timesheets, so you can send a Pleasant Link.</li> : null}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="overflow-hidden">
            <div className="p-5">
              <SectionHeader
                icon={BadgePoundSterling}
                title="Rate card"
                hint="Charge-out rates per hour. New shifts for this client use these unless you enter a rate by hand."
              />
            </div>
            {client.rates.length > 0 ? (
              <div className="overflow-x-auto border-y border-slate-100">
                <table className="min-w-full divide-y divide-slate-100">
                  <thead>
                    <tr>
                      <Th>Role</Th>
                      <Th>Applies to</Th>
                      <Th className="text-right">Day</Th>
                      <Th className="text-right">Night</Th>
                      <Th className="text-right">Weekend</Th>
                      <Th className="text-right">Bank hol.</Th>
                      <Th />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {client.rates.map((rate) => (
                      <tr key={rate.id}>
                        <Td className="font-medium text-slate-900">{rate.role}</Td>
                        <Td className="text-xs text-slate-500">{rate.site?.name ?? "Whole client"}</Td>
                        <Td className="tabular text-right">{money(rate.dayRate)}</Td>
                        <Td className="tabular text-right">{money(rate.nightRate)}</Td>
                        <Td className="tabular text-right">{money(rate.weekendRate)}</Td>
                        <Td className="tabular text-right">{money(rate.bankHolidayRate)}</Td>
                        <Td className="w-8">
                          <form action={deleteRateAction}>
                            <input type="hidden" name="rateId" value={rate.id} />
                            <button type="submit" aria-label={`Remove ${rate.role} rate`} className="text-slate-300 hover:text-red-600">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </form>
                        </Td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
            <div className="p-5">
              <RateForm clientId={client.id} sites={client.sites.map((s) => ({ id: s.id, name: s.name }))} noun={unit} />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader
              icon={Building2}
              title={units[0].toUpperCase() + units.slice(1)}
              hint={
                unit === "branch"
                  ? "The branches you supply carers to. Shifts are booked against a branch."
                  : "Wards or units within the home. Shifts are booked against a unit and carers see it on their app."
              }
            />
            {client.sites.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
                {client.sites.map((site) => (
                  <li key={site.id} className="flex items-start justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium text-slate-900">{site.name}</p>
                      <p className="text-xs text-slate-500">
                        {[site.address, site.postcode].filter(Boolean).join(", ") || "Same address as client"}
                        {" · "}
                        {site._count.shifts} shift{site._count.shifts === 1 ? "" : "s"}
                      </p>
                      {site.notes ? <p className="mt-1 text-xs text-slate-600">{site.notes}</p> : null}
                    </div>
                    <form action={deleteSiteAction}>
                      <input type="hidden" name="siteId" value={site.id} />
                      <button type="submit" aria-label={`Remove ${site.name}`} className="text-slate-300 hover:text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4">
              <SiteForm clientId={client.id} noun={unit} />
            </div>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <SectionHeader icon={CalendarClock} title="Upcoming shifts" />
              <Link href="/shifts" className="text-xs font-medium text-brand-700 hover:text-brand-800">
                All shifts →
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Nothing booked.</p>
            ) : (
              <ul className="mt-3 divide-y divide-slate-100">
                {upcoming.map((shift) => (
                  <li key={shift.id}>
                    <Link href={`/shifts/${shift.id}`} className="flex items-center justify-between gap-3 py-2.5 text-sm hover:text-brand-700">
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{shift.role}{shift.site ? ` · ${shift.site.name}` : ""}</span>
                        <span className="block text-xs text-slate-500">
                          {formatDateTime(shift.startAt)} · {shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : "Unfilled"}
                        </span>
                      </span>
                      <StatusBadge status={shift.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionHeader
              icon={Link2}
              title="Pleasant Link"
              hint="A 24-hour link for a signatory to approve timesheets and request staff — no login needed."
            />
            <div className="mt-4">
              <GenerateLinkButton
                clientId={client.id}
                signatories={signatories.map((c) => ({ id: c.id, name: c.name, jobTitle: c.jobTitle }))}
              />
            </div>
          </Card>

          <Card className="p-5">
            <SectionHeader icon={Users} title="Contacts" hint="Managers, nurses in charge and accounts at this client." />
            {client.contacts.length > 0 ? (
              <ul className="mt-4 divide-y divide-slate-100">
                {client.contacts.map((contact) => (
                  <li key={contact.id} className="py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-900">{contact.name}</p>
                        <p className="truncate text-xs text-slate-500">
                          {[contact.jobTitle, contact.email, contact.phone].filter(Boolean).join(" · ") || "No details"}
                        </p>
                      </div>
                      <form action={deleteContactAction}>
                        <input type="hidden" name="contactId" value={contact.id} />
                        <button type="submit" aria-label={`Remove ${contact.name}`} className="text-slate-300 hover:text-red-600">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </form>
                    </div>
                    <div className="mt-2 flex gap-1.5">
                      <RoleToggle contactId={contact.id} field="isSignatory" on={contact.isSignatory} label="Signs timesheets" />
                      <RoleToggle contactId={contact.id} field="isAccounts" on={contact.isAccounts} label="Invoices" />
                    </div>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-4 border-t border-slate-100 pt-4">
              <ContactForm clientId={client.id} />
            </div>
          </Card>

          {isAdmin ? (
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <SectionHeader icon={Receipt} title="Invoices" />
                <Link href="/billing" className="text-xs font-medium text-brand-700 hover:text-brand-800">
                  Billing →
                </Link>
              </div>
              <p className="mt-3 text-sm text-slate-600">
                Outstanding <span className="tabular font-semibold text-slate-900">{formatCurrency(owed)}</span>
              </p>
              {invoices.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm">
                  {invoices.map((invoice) => (
                    <li key={invoice.id}>
                      <Link href={`/billing/${invoice.id}`} className="flex items-center justify-between gap-2 hover:text-brand-700">
                        <span>
                          <span className="font-medium">{invoice.reference}</span>
                          <span className="text-xs text-slate-500"> · {formatDate(invoice.periodEnd)}</span>
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="tabular text-xs">{formatCurrency(invoice.grandTotal)}</span>
                          <StatusBadge status={invoice.status} />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : null}
            </Card>
          ) : null}

          <Card className="p-5">
            <SectionHeader icon={PenLine} title="Details" />
            <div className="mt-4">
              <ClientForm
                client={{
                  id: client.id,
                  name: clientName(client),
                  type: client.type,
                  address: client.address,
                  postcode: client.postcode,
                  phone: client.phone,
                  email: client.email,
                  vatNumber: client.vatNumber,
                  companyNo: client.companyNo,
                  cqcLocationId: client.cqcLocationId,
                  frameworkRef: client.frameworkRef,
                  paymentTermsDays: client.paymentTermsDays,
                  status: client.status,
                  notes: client.notes,
                }}
              />
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
