import Link from "next/link";
import { AlertTriangle, CalendarClock, CheckCircle2, ShieldCheck, Wallet } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidBankDetails } from "@/lib/payroll/bacs";
import {
  DUE_SOON_DAYS,
  daysUntil,
  expiryLabel,
  expiryState,
  type ExpiryState,
} from "@/lib/compliance";
import { formatDate } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";

export const metadata = { title: "Compliance | Pleasant" };
export const dynamic = "force-dynamic";

const stateStyles: Record<ExpiryState, string> = {
  EXPIRED: "bg-red-100 text-red-800 ring-red-600/15",
  DUE_SOON: "bg-amber-100 text-amber-800 ring-amber-600/15",
  MISSING: "bg-slate-100 text-slate-600 ring-slate-500/15",
  OK: "bg-emerald-100 text-emerald-800 ring-emerald-600/15",
};

type Row = {
  staffId: string;
  staffName: string;
  item: string;
  kind: string;
  state: ExpiryState;
  expiry: Date | null;
};

export default async function CompliancePage() {
  const user = await requireAdmin();
  const now = new Date();

  const staff = await prisma.staffProfile.findMany({
    where: { agencyId: user.agencyId, status: { not: "INACTIVE" } },
    include: { rightToWork: true, trainingRecords: true },
    orderBy: [{ lastName: "asc" }],
  });

  const rows: Row[] = [];

  for (const member of staff) {
    const name = `${member.firstName} ${member.lastName}`;
    rows.push({
      staffId: member.id,
      staffName: name,
      item: "DBS certificate",
      kind: "DBS",
      state: expiryState(member.dbsExpiry, now),
      expiry: member.dbsExpiry,
    });
    rows.push({
      staffId: member.id,
      staffName: name,
      item: "Right to work",
      kind: "RTW",
      state: member.rightToWork ? expiryState(member.rightToWork.expiryDate, now) : "MISSING",
      expiry: member.rightToWork?.expiryDate ?? null,
    });
    for (const record of member.trainingRecords) {
      rows.push({
        staffId: member.id,
        staffName: name,
        item: record.courseName,
        kind: "Training",
        state: expiryState(record.expiryDate, now),
        expiry: record.expiryDate,
      });
    }
  }

  const rank: Record<ExpiryState, number> = { EXPIRED: 0, MISSING: 1, DUE_SOON: 2, OK: 3 };
  rows.sort((a, b) => {
    const diff = rank[a.state] - rank[b.state];
    if (diff !== 0) return diff;
    return daysUntil(a.expiry ?? new Date(8640000000000000), now) - daysUntil(b.expiry ?? new Date(8640000000000000), now);
  });

  const expired = rows.filter((r) => r.state === "EXPIRED");
  const dueSoon = rows.filter((r) => r.state === "DUE_SOON");
  const missing = rows.filter((r) => r.state === "MISSING");
  const clean = rows.filter((r) => r.state === "OK");

  const notPayable = staff.filter(
    (member) => !isValidBankDetails(member.sortCode ?? "", member.bankAcct ?? ""),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compliance"
        description={`DBS, right to work and training certificates across ${staff.length} active carer${staff.length === 1 ? "" : "s"}. Anything expiring within ${DUE_SOON_DAYS} days is flagged.`}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Expired</p>
              <p className="text-2xl font-bold text-red-900">{expired.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Expiring soon</p>
              <p className="text-2xl font-bold text-amber-900">{dueSoon.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Not on file</p>
              <p className="text-2xl font-bold text-slate-900">{missing.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">In date</p>
              <p className="text-2xl font-bold text-emerald-900">{clean.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {notPayable.length > 0 ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
            <div>
              <p className="text-sm font-semibold text-amber-900">
                {notPayable.length} carer{notPayable.length === 1 ? "" : "s"} can&apos;t be paid by bank transfer
              </p>
              <p className="mt-1 text-sm text-amber-800">
                They&apos;ll be left out of the payments file for the run they appear on. Add their sort code and
                account number to fix it.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {notPayable.map((member) => (
                  <Link
                    key={member.id}
                    href={`/staff/${member.id}`}
                    className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    {member.firstName} {member.lastName}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </Card>
      ) : null}

      <Card className="overflow-x-auto">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Certificate tracker</h2>
        </div>
        {rows.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Nothing to track yet"
              description="Add carers and record their DBS and right-to-work details to start tracking expiry dates."
            />
          </div>
        ) : (
          <table className="w-full min-w-[760px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Carer</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Item</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Expiry</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => (
                <tr key={`${row.staffId}-${row.item}-${index}`} className="hover:bg-slate-50">
                  <td className="px-5 py-3.5 font-medium text-slate-900">{row.staffName}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">{row.item}</td>
                  <td className="px-5 py-3.5 text-sm text-slate-700">
                    {row.expiry ? formatDate(row.expiry) : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${stateStyles[row.state]}`}
                    >
                      {expiryLabel(row.expiry, now)}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <Link
                      href={`/staff/${row.staffId}`}
                      className="text-xs font-semibold text-brand-700 hover:underline"
                    >
                      Update
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}