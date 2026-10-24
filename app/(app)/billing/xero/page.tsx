import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { XERO_TAX_TYPES } from "@/lib/billing/xero";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { Card, PageHeader, buttonClass, inputClass, labelClass } from "@/components/ui";

export const metadata = { title: "Export to Xero" };
export const dynamic = "force-dynamic";

export default async function XeroExportPage() {
  const user = await requireAdmin();

  const [issued, paid, lastExport] = await Promise.all([
    prisma.invoice.aggregate({
      where: { agencyId: user.agencyId, status: "ISSUED" },
      _count: true,
      _sum: { grandTotal: true },
    }),
    prisma.invoice.count({ where: { agencyId: user.agencyId, status: "PAID" } }),
    prisma.auditEvent.findFirst({
      where: { agencyId: user.agencyId, action: "invoice.export" },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true, actorEmail: true },
    }),
  ]);
  const vatRegistered = !!user.agency.vatNumber;

  return (
    <div className="space-y-6">
      <Link href="/billing" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Billing
      </Link>

      <PageHeader
        title="Export to Xero"
        description="A CSV in Xero's sales invoice import format, so your client invoices land in Accounts Receivable. No API key or connected app needed."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Issued, unpaid</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">{issued._count}</p>
          <p className="mt-1 text-xs text-slate-500">{formatCurrency(issued._sum.grandTotal ?? 0)} to collect</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Already paid</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">{paid}</p>
          <p className="mt-1 text-xs text-slate-500">Excluded unless you include them below</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Last export</p>
          <p className="mt-1.5 text-sm text-slate-700">
            {lastExport ? formatDateTime(lastExport.createdAt) : "Never"}
          </p>
          {lastExport?.actorEmail ? <p className="mt-1 text-xs text-slate-500">by {lastExport.actorEmail}</p> : null}
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Download</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          One row per invoice line. Draft and void invoices are never exported.
        </p>
        <form action="/billing/xero-export" method="get" className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelClass} htmlFor="since">Issued on or after</label>
            <input id="since" name="since" type="date" className={`${inputClass} mt-1`} />
            <p className="mt-1 text-xs text-slate-500">Leave blank for all. Use your last export date to avoid duplicates.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="account">Sales account code</label>
            <input id="account" name="account" defaultValue="200" maxLength={10} className={`${inputClass} mt-1`} />
            <p className="mt-1 text-xs text-slate-500">200 is &ldquo;Sales&rdquo; in Xero&apos;s default UK chart of accounts.</p>
          </div>
          <div>
            <label className={labelClass} htmlFor="zero">Invoices without VAT use</label>
            <select id="zero" name="zero" defaultValue={vatRegistered ? "exempt" : "noVat"} className={`${inputClass} mt-1`}>
              <option value="exempt">{XERO_TAX_TYPES.exempt}</option>
              <option value="zeroRated">{XERO_TAX_TYPES.zeroRated}</option>
              <option value="noVat">{XERO_TAX_TYPES.noVat}</option>
            </select>
            <p className="mt-1 text-xs text-slate-500">
              20% invoices use &ldquo;{XERO_TAX_TYPES.standard}&rdquo;. Names must match the tax rates in your Xero
              organisation.
            </p>
          </div>
          <div className="flex items-start gap-2 pt-7">
            <input id="paid" name="paid" type="checkbox" value="1" className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600" />
            <label htmlFor="paid" className="text-sm text-slate-700">
              Include paid invoices
              <span className="block text-xs text-slate-500">
                They import as unpaid — record the payment in Xero, or reconcile it against the bank feed.
              </span>
            </label>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className={buttonClass}>
              <Download className="h-4 w-4" /> Download sales invoices CSV
            </button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">How to import it</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>In Xero, go to Business → Invoices.</li>
          <li>Choose Import and upload the downloaded file.</li>
          <li>
            Choose to use the tax rates in the file (the column is <code className="text-xs">*TaxType</code>),
            and leave the amounts as tax exclusive.
          </li>
          <li>Xero creates the invoices as drafts. Check them against Pleasant, then approve.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          Xero matches clients to existing contacts by name and creates any it doesn&apos;t find, so keep
          each client&apos;s name in Pleasant the same as in Xero. It warns about invoice numbers it has
          already imported.
        </p>
      </Card>
    </div>
  );
}
