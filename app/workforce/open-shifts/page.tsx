import { addDays } from "date-fns";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatTime, shiftDurationMins } from "@/lib/utils";
import { StatusBadge } from "@/components/status";
import { requestShiftAction } from "./actions";

export const metadata = { title: "Open shifts" };
export const dynamic = "force-dynamic";

const BANNERS: Record<string, { tone: "good" | "bad"; text: string }> = {
  requested: { tone: "good", text: "Request sent — the agency will review it." },
  overlap: {
    tone: "bad",
    text: "You already have a shift that clashes with this one.",
  },
  gone: { tone: "bad", text: "That shift is no longer open." },
};

type ResultKey = keyof typeof BANNERS;

export default async function OpenShiftsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  const user = await requireUser();
  const profile = user.staff;
  const { result } = await searchParams;
  const banner = result != null && result in BANNERS ? BANNERS[result as ResultKey] : null;

  if (!profile) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
        No carer profile linked yet.
      </div>
    );
  }

  const shifts = await prisma.shift.findMany({
    where: {
      agencyId: user.agencyId,
      staffId: null,
      status: "OPEN",
      startAt: { gte: new Date(), lte: addDays(new Date(), 30) },
    },
    include: { client: true, site: true },
    orderBy: { startAt: "asc" },
    take: 30,
  });

  const requests = shifts.length
    ? await prisma.shiftRequest.findMany({
        where: { staffId: profile.id, shiftId: { in: shifts.map((s) => s.id) } },
        select: { shiftId: true, status: true },
      })
    : [];
  const requestByShift = new Map(requests.map((r) => [r.shiftId, r.status]));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-bold tracking-tight text-slate-900">Open shifts</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Unscheduled shifts your agency needs covering.
        </p>
      </div>

      {banner ? (
        <div
          className={
            banner.tone === "good"
              ? "rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              : "rounded-2xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {shifts.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm font-medium text-slate-700">Nothing open right now</p>
          <p className="mt-1 text-xs text-slate-500">
            No unscheduled shifts in the next 30 days. Check back soon.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {shifts.map((shift) => {
            const where =
              shift.client != null
                ? `${shift.client.firstName} ${shift.client.lastName}`
                : (shift.site?.name ?? "Location TBC");
            const requestStatus = requestByShift.get(shift.id);
            return (
              <div
                key={shift.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900">{shift.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{where}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {formatDate(shift.startAt)} · {formatTime(shift.startAt)} –{" "}
                      {formatTime(shift.endAt)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {Math.round(shiftDurationMins(shift.startAt, shift.endAt) / 60)} h ·{" "}
                      {shift.role}
                    </p>
                    {shift.isSleepIn ? (
                      <p className="mt-1 text-xs font-medium text-indigo-700">
                        Sleep-in · {formatCurrency(Number(shift.sleepInRate))} flat
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={shift.status} />
                </div>

                {requestStatus === "PENDING" ? (
                  <p className="mt-4 rounded-full bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-700">
                    Request pending — awaiting agency approval
                  </p>
                ) : requestStatus === "APPROVED" ? (
                  <p className="mt-4 rounded-full bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
                    Approved — this shift is yours
                  </p>
                ) : (
                  <form action={requestShiftAction} className="mt-4 space-y-2">
                    <input type="hidden" name="shiftId" value={shift.id} />
                    {requestStatus === "REJECTED" ? (
                      <p className="text-center text-xs font-medium text-red-600">
                        Your last request wasn&apos;t accepted. You can try again.
                      </p>
                    ) : null}
                    <input
                      name="message"
                      type="text"
                      placeholder="Optional note (e.g. happy to do nights)"
                      className="w-full rounded-full border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-200"
                    />
                    <button
                      type="submit"
                      className="w-full rounded-full bg-brand-600 px-4 py-3 text-base font-semibold text-white active:scale-[0.99]"
                    >
                      Request this shift
                    </button>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-center text-xs text-slate-400">
        All open shifts across the agency · up to 30 days ahead
      </p>
    </div>
  );
}