import Link from "next/link";
import { ArrowLeft, Download } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Export to Xero | Pleasant" };
export const dynamic = "force-dynamic";

export default async function XeroExportPage() {
  const user = await requireAdmin();

  const invoices = await prisma.invoice.findMany({
    where: { agencyId: user.agencyId, status: { in: ["ISSUED", "PAID"] } },
    select: { status: true, grandTotal: true },
  });

  const total = invoices.reduce((sum, i) => sum + Number(i.grandTotal), 0);

  return (
    <div className="space-y-6">
      <Link href="/billing" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> Billing
      </Link>

      <PageHeader
        title="Export to Xero"
        description="One CSV that Xero's Import Bills tool accepts — no API key or connected app needed."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Invoices ready to export</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">{invoices.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Total value</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">
            {formatCurrency(total)}
          </p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Drafts excluded</p>
          <p className="mt-1.5 text-sm text-slate-600">
            Drafts stay internal until you issue them.
          </p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Download</h2>
        <p className="mt-1.5 text-sm text-slate-600">
          One row per invoice line. Issued invoices import as <strong>Submitted</strong>, paid ones as{" "}
          <strong>Paid</strong>. Contacts match on name, so use the home&apos;s trading name in Clients if
          it differs from the person.
        </p>
        <Link
          href="/billing/xero-export"
          prefetch={false}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
        >
          <Download className="h-4 w-4" /> Download bills CSV
        </Link>
      </Card>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">How to import it</h2>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm text-slate-600">
          <li>In Xero, go to Accounting → Business → Bills.</li>
          <li>Choose Import and pick the downloaded file.</li>
          <li>
            Map the columns if Xero asks — the headers are already named to match its own
            field names, so it usually detects them.
          </li>
          <li>Check the draft bills, then approve.</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500">
          If Xero creates duplicate contacts, add its ContactID column and match on the client&apos;s
          Xero reference instead.
        </p>
      </Card>
    </div>
  );
}