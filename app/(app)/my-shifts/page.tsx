import Link from "next/link";
import { addDays } from "date-fns";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { nextCutoff, payDayForCutoff, weekdayName } from "@/lib/week";
import { formatCurrency, formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { SignOffForm } from "@/components/SignOffForm";
import {
  clockInFormAction,
  clockOutAction,
  saveCandidateSignatureAction,
} from "@/app/(app)/timesheets/actions";

export const metadata = { title: "My shifts" };
export const dynamic = "force-dynamic";

export default async function MyShiftsPage() {
  const user = await requireUser();
  const profile = user.staff;

  if (!profile) {
    return (
      <div className="mx-auto max-w-xl space-y-6">
        <PageHeader title="My shifts" description="Your rota, timesheets and sign-off." />
        <EmptyState
          title="No carer profile linked"
          description="Your login isn't linked to a carer record yet. Ask your agency manager to link it."
        />
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
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title={`Hi ${profile.firstName}`}
        description={`${profile.jobTitle} · ${user.agency.name}`}
      />

      <Card className="border-brand-200 bg-brand-50 p-4 text-sm text-brand-900">
        Sign off your shifts before{" "}
        <strong>
          {weekdayName(user.agency.cutoffWeekday)} {formatTime(cutoff)}
        </strong>{" "}
        to be paid on <strong>{formatDate(payDay)}</strong>.
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Upcoming shifts
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState title="Nothing scheduled" description="Enjoy the time off — new shifts will appear here." />
        ) : (
          upcoming.map((shift) => <ShiftCard key={shift.id} shift={shift} />)
        )}
      </section>

      {recent.length > 0 ? (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Recent shifts
          </h2>
          {recent.map((shift) => <ShiftCard key={shift.id} shift={shift} />)}
        </section>
      ) : null}

      <Link
        href={`/timesheets/sheet?staffId=${profile.id}`}
        className="block rounded-2xl border border-slate-200 bg-white p-4 text-center text-sm font-medium text-brand-700 shadow-sm"
      >
        View my weekly timesheet sheet
      </Link>
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
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-slate-900">{shift.title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{where}</p>
          <p className="mt-1 text-sm text-slate-600">
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

      <div className="mt-3 flex flex-col gap-2">
        {!ts ? (
          <form action={clockInFormAction}>
            <input type="hidden" name="shiftId" value={shift.id} />
            <input type="hidden" name="breakMins" value={shift.breakMins} />
            <button
              type="submit"
              className="w-full rounded-xl bg-brand-600 px-4 py-3 text-base font-semibold text-white active:bg-brand-700"
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
              className="w-full rounded-xl bg-slate-900 px-4 py-3 text-base font-semibold text-white"
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
          <p className="rounded-xl bg-emerald-50 px-4 py-2 text-center text-sm font-medium text-emerald-700">
            Signed off{ts.clientAuthAt ? " · client authorised" : " · awaiting client sign-off"}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
