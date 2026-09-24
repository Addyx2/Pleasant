import { LogOut } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { nextCutoff, payDayForCutoff, weekdayName } from "@/lib/week";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { InstallAppButton } from "@/components/InstallAppButton";
import { logoutAction } from "@/app/login/actions";

export const metadata = { title: "Profile" };
export const dynamic = "force-dynamic";

export default async function WorkforceProfilePage() {
  const user = await requireUser();
  const profile = user.staff;
  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No carer profile linked yet.
      </div>
    );
  }

  const cutoff = nextCutoff({
    cutoffWeekday: user.agency.cutoffWeekday,
    cutoffTime: user.agency.cutoffTime,
    payWeekday: user.agency.payWeekday,
  });
  const payDay = payDayForCutoff(
    {
      cutoffWeekday: user.agency.cutoffWeekday,
      cutoffTime: user.agency.cutoffTime,
      payWeekday: user.agency.payWeekday,
    },
    cutoff,
  );

  const rates = [
    { label: "Base rate", value: profile.baseRate },
    { label: "Night", value: profile.nightRate },
    { label: "Weekend", value: profile.weekendRate },
    { label: "Bank holiday", value: profile.bankHolidayRate },
  ].filter((r) => r.value != null) as { label: string; value: unknown }[];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-white p-6 text-center shadow-sm ring-1 ring-slate-200">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-xl font-bold text-white">
          {profile.firstName[0]}
          {profile.lastName?.[0] ?? ""}
        </span>
        <h1 className="mt-3 text-lg font-bold tracking-tight text-slate-900">
          {profile.firstName} {profile.lastName}
        </h1>
        <p className="text-sm text-slate-500">
          {profile.jobTitle}
          {profile.band ? ` · ${profile.band}` : ""}
        </p>
      </div>

      <InstallAppButton />

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Your rates</h2>
        <div className="mt-3 space-y-2">
          {rates.map((r) => (
            <div key={r.label} className="flex items-center justify-between text-sm">
              <span className="text-slate-600">{r.label}</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(Number(r.value))}
                <span className="text-xs font-normal text-slate-400">/hr</span>
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <span className="text-slate-600">Holiday accrual</span>
            <span className="font-semibold text-slate-900">
              {Number(profile.holidayAccrualPct).toFixed(1)}%
            </span>
          </div>
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">Engagement</h2>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Type</span>
            <span className="font-semibold text-slate-900">
              {profile.engagementType === "LTD" ? "Ltd company" : "PAYE"}
            </span>
          </div>
          {profile.engagementType === "LTD" && profile.ltdCompanyName ? (
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Company</span>
              <span className="font-semibold text-slate-900">{profile.ltdCompanyName}</span>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Paid weekly on</span>
            <span className="font-semibold text-slate-900">{formatDate(payDay)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-600">Sign-off cutoff</span>
            <span className="font-semibold text-slate-900">
              {weekdayName(user.agency.cutoffWeekday)} {formatTime(cutoff)}
            </span>
          </div>
        </div>
        <p className="mt-3 rounded-2xl bg-brand-50 p-3 text-xs text-brand-900">
          Shift hours clocked before {weekdayName(user.agency.cutoffWeekday)} {formatTime(cutoff)} are
          paid on {formatDate(payDay)}.
        </p>
      </section>

      <form action={logoutAction}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </form>
    </div>
  );
}