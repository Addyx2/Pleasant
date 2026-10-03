import { Building2, Landmark, Receipt } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidBankDetails } from "@/lib/payroll/bacs";
import { Card, PageHeader, buttonClass, inputClass, labelClass } from "@/components/ui";
import {
  saveAgencyBankDetailsAction,
  saveAgencyInvoiceDetailsAction,
} from "@/app/(app)/settings/actions";

export const metadata = { title: "Settings | Pleasant" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const user = await requireAdmin();
  const agency = await prisma.agency.findUniqueOrThrow({ where: { id: user.agencyId } });

  const originatorReady = isValidBankDetails(agency.bankSortCode ?? "", agency.bankAccount ?? "");
  const payRunCount = await prisma.payrollRun.count({
    where: { agencyId: user.agencyId, status: { not: "DRAFT" } },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Agency settings"
        description={`${agency.name} · details used on invoices and bank payment files.`}
      />

      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <Building2 className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">Invoice details</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Printed on every invoice and used as the from-address on outgoing email.
        </p>
        <form action={saveAgencyInvoiceDetailsAction} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="companyNo">Company number</label>
            <input
              id="companyNo"
              name="companyNo"
              defaultValue={agency.companyNo ?? ""}
              placeholder="12345678"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="vatNumber">VAT number</label>
            <input
              id="vatNumber"
              name="vatNumber"
              defaultValue={agency.vatNumber ?? ""}
              placeholder="GB123456789"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="invoiceEmail">Invoice email</label>
            <input
              id="invoiceEmail"
              name="invoiceEmail"
              type="email"
              defaultValue={agency.invoiceEmail ?? ""}
              placeholder="billing@youragency.co.uk"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={buttonClass}>Save invoice details</button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <Landmark className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">BACS originator details</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Your own account that funds each pay run. These appear on the fixed-width STD18 file,
          not on the carer-facing CSV.
        </p>
        {!originatorReady ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            Not set. Bank payments CSV still works, but the STD18 download stays unavailable
            until a 6-digit sort code and 8-digit account number are saved here.
          </p>
        ) : null}
        <form action={saveAgencyBankDetailsAction} className="mt-4 grid gap-4 sm:grid-cols-3">
          <div>
            <label className={labelClass} htmlFor="bankAccountName">Account name</label>
            <input
              id="bankAccountName"
              name="bankAccountName"
              defaultValue={agency.bankAccountName ?? ""}
              placeholder={agency.name}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="bankSortCode">Sort code</label>
            <input
              id="bankSortCode"
              name="bankSortCode"
              inputMode="numeric"
              defaultValue={agency.bankSortCode ?? ""}
              placeholder="20-00-00"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor="bankAccount">Account number</label>
            <input
              id="bankAccount"
              name="bankAccount"
              inputMode="numeric"
              defaultValue={agency.bankAccount ?? ""}
              placeholder="12345678"
              className={inputClass}
            />
          </div>
          <div className="sm:col-span-3">
            <button type="submit" className={buttonClass}>Save originator details</button>
          </div>
        </form>
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-2.5">
          <Receipt className="h-4 w-4 text-brand-600" />
          <h2 className="text-sm font-semibold text-slate-900">HMRC and pay cycle</h2>
        </div>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">PAYE reference</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {agency.payrollRef ?? <span className="text-slate-400">Not recorded</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Pay frequency</dt>
            <dd className="mt-0.5 font-medium text-slate-900">
              {agency.payFrequency.replace(/_/g, " ").toLowerCase()}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Rounding</dt>
            <dd className="mt-0.5 font-medium text-slate-900">{agency.roundingMins} minutes</dd>
          </div>
        </dl>
        <p className="mt-4 text-xs text-slate-500">
          {payRunCount} pay run{payRunCount === 1 ? "" : "s"} have been finalised. Day-to-day
          roster and billing settings live with Clients and Payroll.
        </p>
      </Card>
    </div>
  );
}