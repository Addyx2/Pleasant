import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Plus } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { isValidBankDetails } from "@/lib/payroll/bacs";
import { expiryLabel, expiryState } from "@/lib/compliance";
import { formatCurrency, formatDate, initials } from "@/lib/utils";
import { Card, PageHeader, inputClass, labelClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import {
  addTrainingAction,
  saveBankDetailsAction,
  saveDbsAction,
  saveRightToWorkAction,
} from "@/app/(app)/compliance/actions";

export const metadata = { title: "Carer | Pleasant" };
export const dynamic = "force-dynamic";

function isoDate(value: Date | null | undefined): string {
  if (!value) return "";
  return value.toISOString().slice(0, 10);
}

export default async function StaffDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireAdmin();
  const now = new Date();

  const member = await prisma.staffProfile.findFirst({
    where: { id, agencyId: user.agencyId },
    include: { rightToWork: true, trainingRecords: { orderBy: { expiryDate: "asc" } } },
  });

  if (!member) notFound();

  const payReady = isValidBankDetails(member.sortCode ?? "", member.bankAcct ?? "");
  const dbs = expiryState(member.dbsExpiry, now);
  const rtw = member.rightToWork ? expiryState(member.rightToWork.expiryDate, now) : "MISSING";

  return (
    <div className="space-y-6">
      <Link href="/staff" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
        <ArrowLeft className="h-4 w-4" /> All carers
      </Link>

      <PageHeader
        title={`${member.firstName} ${member.lastName}`}
        description={`${member.jobTitle}${member.band ? ` · ${member.band}` : ""} · ${(member.engagementType ?? "PAYE") === "LTD" ? (member.ltdCompanyName ?? "Ltd") : "PAYE"} · ${formatCurrency(Number(member.baseRate))}/hr`}
        action={<StatusBadge status={member.status} />}
      />

      {!payReady ? (
        <Card className="border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No usable bank details on file — this carer will be skipped by the payroll payments file. Add a
          6-digit sort code and 8-digit account number below.
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Bank details</h2>
          <p className="mt-1 text-xs text-slate-500">Used to build the BACS payments file each pay run.</p>
          <form action={saveBankDetailsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="staffId" value={member.id} />
            <div>
              <label className={labelClass} htmlFor="accountName">Account name</label>
              <input
                id="accountName"
                name="accountName"
                defaultValue={member.accountName ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bankName">Bank</label>
              <input id="bankName" name="bankName" defaultValue={member.bankName ?? ""} className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="sortCode">Sort code</label>
              <input
                id="sortCode"
                name="sortCode"
                inputMode="numeric"
                defaultValue={member.sortCode ?? ""}
                placeholder="20-00-00"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="bankAcct">Account number</label>
              <input
                id="bankAcct"
                name="bankAcct"
                inputMode="numeric"
                defaultValue={member.bankAcct ?? ""}
                placeholder="12345678"
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={subtleButtonClass}>
                Save bank details
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">DBS certificate</h2>
            <span className="text-xs text-slate-500">{expiryLabel(member.dbsExpiry, now)}</span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Care homes must hold a current enhanced DBS check for every worker on shift.
          </p>
          <form action={saveDbsAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="staffId" value={member.id} />
            <div>
              <label className={labelClass} htmlFor="dbsNumber">Certificate number</label>
              <input
                id="dbsNumber"
                name="dbsNumber"
                defaultValue={member.dbsNumber ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="dbsExpiry">Issue / update date</label>
              <input
                id="dbsExpiry"
                name="dbsExpiry"
                type="date"
                defaultValue={isoDate(member.dbsExpiry)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={subtleButtonClass}>
                Save DBS record
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900">Right to work</h2>
            <span className="text-xs text-slate-500">
              {member.rightToWork ? expiryLabel(member.rightToWork.expiryDate, now) : "Not recorded"}
            </span>
          </div>
          <form action={saveRightToWorkAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <input type="hidden" name="staffId" value={member.id} />
            <div>
              <label className={labelClass} htmlFor="documentType">Document type</label>
              <select
                id="documentType"
                name="documentType"
                defaultValue={member.rightToWork?.documentType ?? "SHARE_CODE"}
                className={inputClass}
              >
                <option value="PASSPORT">Passport</option>
                <option value="BRP">Brp card</option>
                <option value="SHARE_CODE">Share code</option>
                <option value="BIRTH_CERTIFICATE">Birth certificate</option>
              </select>
            </div>
            <div>
              <label className={labelClass} htmlFor="documentNumber">Document number</label>
              <input
                id="documentNumber"
                name="documentNumber"
                defaultValue={member.rightToWork?.documentNumber ?? ""}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="issueDate">Issue date</label>
              <input
                id="issueDate"
                name="issueDate"
                type="date"
                defaultValue={isoDate(member.rightToWork?.issueDate)}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="expiryDate">Expiry date</label>
              <input
                id="expiryDate"
                name="expiryDate"
                type="date"
                defaultValue={isoDate(member.rightToWork?.expiryDate)}
                className={inputClass}
              />
            </div>
            <div className="sm:col-span-2">
              <button type="submit" className={subtleButtonClass}>
                Save right-to-work record
              </button>
            </div>
          </form>
        </Card>

        <Card className="p-5">
          <h2 className="text-sm font-semibold text-slate-900">Training &amp; certificates</h2>
          {member.trainingRecords.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Nothing recorded yet — add mandatory training below.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {member.trainingRecords.map((record) => {
                const state = expiryState(record.expiryDate, now);
                return (
                  <li key={record.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-800">{record.courseName}</span>
                    <span
                      className={
                        state === "EXPIRED"
                          ? "text-xs font-semibold text-red-700"
                          : state === "DUE_SOON"
                            ? "text-xs font-semibold text-amber-700"
                            : "text-xs text-slate-500"
                      }
                    >
                      {record.expiryDate
                        ? `${formatDate(record.expiryDate)} · ${expiryLabel(record.expiryDate, now)}`
                        : "No expiry"}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <form action={addTrainingAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="staffId" value={member.id} />
            <div className="sm:col-span-2">
              <label className={labelClass} htmlFor="courseName">Course</label>
              <input
                id="courseName"
                name="courseName"
                placeholder="Manual Handling"
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass} htmlFor="provider">Provider</label>
              <input id="provider" name="provider" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="completedAt">Completed</label>
              <input id="completedAt" name="completedAt" type="date" className={inputClass} />
            </div>
            <div>
              <label className={labelClass} htmlFor="expiry">Expires</label>
              <input id="expiry" name="expiryDate" type="date" className={inputClass} />
            </div>
            <div className="flex items-end">
              <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <Plus className="h-4 w-4" /> Add record
              </button>
            </div>
          </form>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
        <dl className="mt-3 grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-xs text-slate-500">DBS</dt>
            <dd className="text-sm text-slate-800">{expiryLabel(member.dbsExpiry, now)} ({dbs})</dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Right to work</dt>
            <dd className="text-sm text-slate-800">
              {member.rightToWork ? expiryLabel(member.rightToWork.expiryDate, now) : "Not recorded"} ({rtw})
            </dd>
          </div>
          <div>
            <dt className="text-xs text-slate-500">Bank transfer ready</dt>
            <dd className="text-sm text-slate-800">{payReady ? "Yes" : "No"}</dd>
          </div>
        </dl>
      </Card>

      <p className="text-xs text-slate-400">Carer ID {initials(member.firstName, member.lastName)}</p>
    </div>
  );
}