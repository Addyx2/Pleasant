import Link from "next/link";
import { ShieldCheck } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { expiryLabel, expiryState, type ExpiryState } from "@/lib/compliance";
import { prisma } from "@/lib/db";

export const metadata = { title: "Passport" };
export const dynamic = "force-dynamic";

const STATE: Record<ExpiryState, { label: string; tone: string }> = {
  OK: { label: "Up to date", tone: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  DUE_SOON: { label: "Renew soon", tone: "bg-amber-50 text-amber-800 border-amber-200" },
  EXPIRED: { label: "Expired", tone: "bg-red-50 text-red-700 border-red-200" },
  MISSING: { label: "Not recorded", tone: "bg-slate-50 text-slate-600 border-slate-200" },
};

/** The carer's checks and training, exactly as their agency has recorded them. */
export default async function WorkforcePassportPage() {
  const user = await requireUser();
  const profile = user.staff
    ? await prisma.staffProfile.findUnique({
        where: { id: user.staff.id },
        include: { rightToWork: true, trainingRecords: { orderBy: { expiryDate: "asc" } } },
      })
    : null;
  if (!profile) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">No carer profile linked yet.</div>;
  }

  const now = new Date();
  const rtw = profile.rightToWork;
  const rows = [
    { title: "DBS check", detail: profile.dbsNumber ? `Certificate ${profile.dbsNumber}` : null, state: expiryState(profile.dbsExpiry, now), when: expiryLabel(profile.dbsExpiry, now) },
    {
      title: "Right to work",
      detail: rtw ? `${rtw.documentType.replace(/_/g, " ").toLowerCase()}${rtw.status === "VERIFIED" ? ", checked by your agency" : ""}` : null,
      state: rtw ? expiryState(rtw.expiryDate, now) : ("MISSING" as const),
      when: rtw ? (rtw.expiryDate ? expiryLabel(rtw.expiryDate, now) : "No expiry recorded") : "Not recorded",
    },
    ...profile.trainingRecords.map((t) => ({
      title: t.courseName,
      detail: t.provider,
      state: t.completedAt ? expiryState(t.expiryDate, now) : ("MISSING" as const),
      when: t.completedAt ? expiryLabel(t.expiryDate, now) : "Not completed yet",
    })),
  ];
  const needAction = rows.filter((r) => r.state !== "OK").length;

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Passport</h1>
        <p className="text-xs text-slate-500">Your checks and training, as {user.agency.name} has recorded them.</p>
      </div>

      <div className={`flex items-center gap-3 rounded-2xl border p-4 ${needAction === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-amber-200 bg-amber-50 text-amber-900"}`}>
        <ShieldCheck className="h-6 w-6 shrink-0" />
        <p className="text-sm font-semibold">
          {needAction === 0 ? "Everything is up to date." : `${needAction} item${needAction === 1 ? " needs" : "s need"} attention. Speak to ${user.agency.name} to update ${needAction === 1 ? "it" : "them"}.`}
        </p>
      </div>

      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.title} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-900">{r.title}</p>
              {r.detail ? <p className="mt-0.5 text-xs text-slate-500">{r.detail}</p> : null}
              <p className="mt-1 text-xs text-slate-500">{r.when}</p>
            </div>
            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${STATE[r.state].tone}`}>{STATE[r.state].label}</span>
          </li>
        ))}
      </ul>
      {profile.trainingRecords.length === 0 ? <p className="text-xs text-slate-500">No training recorded yet.</p> : null}

      <Link href="/workforce/profile" className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800">Your profile, pay rates and sign out →</Link>
    </div>
  );
}
