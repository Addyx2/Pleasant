import Link from "next/link";
import { addDays } from "date-fns";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextCutoff, payDayForCutoff, weekdayName } from "@/lib/week";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { StatusBadge } from "@/components/status";
import { SignOffForm } from "@/components/SignOffForm";
import {
  clockInFormAction,
  clockOutAction,
  saveCandidateSignatureAction,
} from "@/app/(app)/timesheets/actions";

export const dynamic = "force-dynamic";

export default async function WorkforceHomePage() {
  const user = await requireUser();
  const profile = user.staff;

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        Your login isn&apos;t linked to a carer record yet. Ask your agency manager to link it.
      </div>
    );
  }

  const now = new Date();
  const upcoming = await prisma.shift.findMany({
    where: {
      agencyId: user.agencyId,
      staffId: profile.id,
      startAt: { gte: new Date(now.getTime() - 1000 * 60 * 60 * 12) },
      status: { notIn: ["CANCELLED"] },
    },
    include: { client: true, site: true, timesheet: true },
    orderBy: { startAt: "asc" },
    take: 20,
  });

  const recent = await prisma.shift.findMany({
    where: {
      agencyId: user.agencyId,
      staffId: profile.id,
      startAt: { gte: addDays(now, -14), lt: now },
    },
    include: { client: true, site: true, timesheet: true },
    orderBy: { startAt: "desc" },
    take: 10,
  });

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

  return (
    <div className="space-y-5">
      <div className="rounded-3xl bg-brand-600 p-5 text-white">
        <p className="text-sm text-brand-100">
          Sign off your shifts before{" "}
          <strong className="font-semibold text-white">
            {weekdayName(user.agency.cutoffWeekday)} · {formatTime(cutoff)}
          </strong>{" "}
          to be paid on <strong className="font-semibold text-white">{formatDate(payDay)}</strong>.
        </p>
      </div>

      <section className="space-y-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Upcoming shifts
        </h2>
        {upcoming.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm font-medium text-slate-700">Nothing scheduled</p>
            <p className="mt-1 text-xs text-slate-500">
              Enjoy the time off — check open shifts to pick up more.
            </p>
            <Link
              href="/workforce/open-shifts"
              className="mt-4 inline-block rounded-full bg-brand-600 px-5 py-2 text-sm font-semibold text-white"
            >
              Browse open shifts
            </Link>
          </div>
        ) : (
          upcoming.map((shift) => <ShiftCard key={shift.id} shift={shift} />)
        )}
      </section>

      {recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Recent shifts
          </h2>
          {recent.map((shift) => <ShiftCard key={shift.id} shift={shift} />)}
        </section>
      ) : null}
    </div>
  );
}

type ShiftWithRelations = {
  id: string;
  title: string;
  role: string;
  startAt: Date;
  endAt: Date;
  breakMins: number;
  isSleepIn: boolean;
  sleepInRate: unknown;
  chargeRate: unknown;
  status: string;
  notes: string | null;
  client: { firstName: string; lastName: string } | null;
  site: { name: string } | null;
  timesheet: {
    id: string;
    clockIn: Date;
    clockOut: Date | null;
    candidateSignedAt: Date | null;
    clientAuthAt: Date | null;
    status: string;
  } | null;
};

function ShiftCard({ shift }: { shift: ShiftWithRelations }) {
  const ts = shift.timesheet;
  const where =
    shift.client != null
      ? `${shift.client.firstName} ${shift.client.lastName}`
      : (shift.site?.name ?? "Location TBC");

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{shift.title}</p>
          <p className="mt-1 text-sm text-slate-600">{where}</p>
          <p className="mt-1 text-xs text-slate-500">
            {formatDate(shift.startAt)} · {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
          </p>
          {shift.isSleepIn ? (
            <p className="mt-1 text-xs font-medium text-indigo-700">
              Sleep-in · {formatCurrency(Number(shift.sleepInRate))} flat
            </p>
          ) : null}
        </div>
        <StatusBadge status={ts?.status ?? shift.status} />
      </div>

      <div className="mt-4 flex flex-col gap-2">
        {!ts ? (
          <form action={clockInFormAction}>
            <input type="hidden" name="shiftId" value={shift.id} />
            <input type="hidden" name="breakMins" value={shift.breakMins} />
            <button
              type="submit"
              className="w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white active:scale-[0.99]"
            >
              Clock in
            </button>
          </form>
        ) : null}

        {ts && !ts.clockOut ? (
          <form action={clockOutAction}>
            <input type="hidden" name="timesheetId" value={ts.id} />
            <button
              type="submit"
              className="w-full rounded-full bg-slate-900 px-4 py-3 text-base font-semibold text-white active:scale-[0.99]"
            >
              Clock out
            </button>
          </form>
        ) : null}

        {ts?.clockOut && !ts.candidateSignedAt ? (
          <SignOffForm
            timesheetId={ts.id}
            mode="candidate"
            action={saveCandidateSignatureAction}
            buttonLabel="Sign off this shift"
            title="Sign off this shift"
            subtitle={`${shift.title} · ${formatDateTime(shift.startAt)}`}
          />
        ) : null}

        {ts?.candidateSignedAt ? (
          <p className="rounded-full bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-700">
            Signed off{ts.clientAuthAt ? " · client authorised" : " · awaiting client sign-off"}
          </p>
        ) : null}
      </div>
    </div>
  );
}