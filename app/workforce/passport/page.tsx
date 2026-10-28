import Link from "next/link";

import { requireUser } from "@/lib/auth";
import { daysUntil, expiryState, type ExpiryState } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { formatDate } from "@/lib/utils";

import { Empty, PageTitle, Panel, Pill, Section } from "../ui";

export const metadata = { title: "Passport" };
export const dynamic = "force-dynamic";

const STATE: Record<ExpiryState, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
  OK: { label: "Up to date", tone: "green" },
  DUE_SOON: { label: "Renew soon", tone: "amber" },
  EXPIRED: { label: "Expired", tone: "red" },
  MISSING: { label: "Not recorded", tone: "slate" },
};

interface Row {
  title: string;
  detail: string | null;
  state: ExpiryState;
  expires: Date | null;
}

function when(row: Row): string {
  if (row.state === "MISSING") return "Not recorded yet";
  if (!row.expires) return "No expiry";
  const days = daysUntil(row.expires);
  if (days < 0) return `Expired ${formatDate(row.expires)}`;
  if (days <= 60) return `Expires in ${days} day${days === 1 ? "" : "s"}`;
  return `Valid until ${formatDate(row.expires)}`;
}

/** The carer's checks and training, exactly as their agency has recorded them. */
export default async function WorkforcePassportPage() {
  const user = await requireUser();
  const profile = user.staff
    ? await prisma.staffProfile.findUnique({
        where: { id: user.staff.id },
        include: { rightToWork: true, trainingRecords: { orderBy: { expiryDate: "asc" } } },
      })
    : null;
  if (!profile) return <Empty>No carer profile linked yet.</Empty>;

  const now = new Date();
  const rtw = profile.rightToWork;
  const statutory: Row[] = [
    { title: "DBS check", detail: profile.dbsNumber ? `Certificate ${profile.dbsNumber}` : null, state: expiryState(profile.dbsExpiry, now), expires: profile.dbsExpiry },
    {
      title: "Right to work",
      detail: rtw ? [rtw.documentType.replace(/_/g, " ").toLowerCase(), rtw.status === "VERIFIED" ? "checked by your agency" : null].filter(Boolean).join(" · ") : null,
      state: rtw ? (rtw.expiryDate ? expiryState(rtw.expiryDate, now) : rtw.status === "VERIFIED" ? "OK" : "MISSING") : "MISSING",
      expires: rtw?.expiryDate ?? null,
    },
  ];
  const training: Row[] = profile.trainingRecords.map((t) => ({
    title: t.courseName,
    detail: t.provider,
    state: t.completedAt ? expiryState(t.expiryDate, now) : "MISSING",
    expires: t.expiryDate,
  }));
  const all = [...statutory, ...training];
  const upToDate = all.filter((r) => r.state === "OK").length;
  const pct = all.length ? Math.round((upToDate / all.length) * 100) : 0;
  const attention = all.length - upToDate;
  const ring = 2 * Math.PI * 26;

  return (
    <div className="space-y-6 pb-8">
      <PageTitle title="Passport" subtitle={`Your checks and training, as ${user.agency.name} has recorded them.`} />

      <Panel className="flex items-center gap-4">
        <svg viewBox="0 0 64 64" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden="true">
          <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" className="stroke-slate-100" />
          <circle cx="32" cy="32" r="26" fill="none" strokeWidth="7" strokeLinecap="round" strokeDasharray={`${(pct / 100) * ring} ${ring}`} className={attention === 0 ? "stroke-emerald-500" : "stroke-amber-500"} />
        </svg>
        <div className="min-w-0">
          <p className="font-mono text-2xl font-bold text-slate-900">{pct}%</p>
          <p className="text-sm text-slate-600">
            {attention === 0 ? "Everything is up to date." : `${attention} of ${all.length} need${attention === 1 ? "s" : ""} attention. Speak to ${user.agency.name} to update ${attention === 1 ? "it" : "them"}.`}
          </p>
        </div>
      </Panel>

      <PassportSection label="Statutory checks" rows={statutory} />
      {training.length > 0 ? <PassportSection label={`Training · ${training.length}`} rows={training} /> : (
        <Section label="Training"><Empty>No training recorded yet.</Empty></Section>
      )}

      <Link href="/workforce/profile" className="block rounded-2xl border border-slate-200 bg-white p-4 text-sm font-semibold text-slate-800">Your profile, pay rates and sign out →</Link>
    </div>
  );
}

function PassportSection({ label, rows }: { label: string; rows: Row[] }) {
  return (
    <Section label={label}>
      <ul className="space-y-2">
        {rows.map((r) => (
          <li key={r.title}>
            <Panel className="flex items-start justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{r.title}</p>
                {r.detail ? <p className="mt-0.5 text-xs text-slate-500 first-letter:uppercase">{r.detail}</p> : null}
                <p className={`mt-1 font-mono text-[11px] ${r.state === "OK" ? "text-slate-500" : r.state === "MISSING" ? "text-slate-500" : r.state === "EXPIRED" ? "text-red-700" : "text-amber-700"}`}>{when(r)}</p>
              </div>
              <Pill tone={STATE[r.state].tone}>{STATE[r.state].label}</Pill>
            </Panel>
          </li>
        ))}
      </ul>
    </Section>
  );
}
