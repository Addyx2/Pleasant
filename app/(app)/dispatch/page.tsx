import { CalendarClock, Clock, Plus, UserCheck, Users } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { offerShiftAction, withdrawOfferAction } from "./actions";

export const metadata = {
  title: "Dispatch | Pleasant",
};

export const dynamic = "force-dynamic";

export default async function DispatchPage() {
  const user = await requireAdmin();

  const [activeStaff, pendingOffers, acceptedOffers, unfilledShifts] = await Promise.all([
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.shiftOffer.findMany({
      where: { agencyId: user.agencyId, status: "OFFERED" },
      include: {
        shift: { include: { client: true, site: true } },
        staff: { select: { firstName: true, lastName: true } },
      },
      orderBy: { offeredAt: "desc" },
      take: 50,
    }),
    prisma.shiftOffer.count({
      where: { agencyId: user.agencyId, status: "ACCEPTED" },
    }),
    prisma.shift.findMany({
      where: {
        agencyId: user.agencyId,
        status: { in: ["OPEN", "UNATTENDED"] },
        staffId: null,
        startAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
      include: { client: true, site: true },
      orderBy: { startAt: "asc" },
      take: 50,
    }),
  ]);

  const staffById = new Map(activeStaff.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="Offer empty shifts to your carers and track who has accepted."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-amber-800">Shifts to cover</p>
              <p className="text-2xl font-bold text-amber-900">{unfilledShifts.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 text-indigo-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-indigo-800">Awaiting response</p>
              <p className="text-2xl font-bold text-indigo-900">{pendingOffers.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <UserCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Accepted</p>
              <p className="text-2xl font-bold text-emerald-900">{acceptedOffers}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Users className="h-4 w-4 text-slate-400" />
            <h2 className="text-sm font-semibold text-slate-900">Shift cover needed</h2>
          </div>
<p className="text-xs text-slate-500">
                    {staffById.size} active carer{staffById.size === 1 ? "" : "s"} available to offer to
                  </p>
        </div>
        {unfilledShifts.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="Every shift is covered"
              description="Open and unattended shifts yet to be assigned will appear here."
            />
          </div>
        ) : (
          <table className="w-full min-w-[900px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Shift</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Client & site</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">When</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Status</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Offer to carer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unfilledShifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{shift.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{shift.role}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {shift.client ? `${shift.client.firstName} ${shift.client.lastName}` : "No client"}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">{shift.site?.name ?? "Unknown site"}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="tabular text-sm text-slate-700">
                      {formatDate(shift.startAt)} · {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    {shift.status === "UNATTENDED" ? (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-600/15">
                        Unattended
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/15">
                        Open
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {staffById.size > 0 ? (
                      <form action={offerShiftAction} className="inline-flex items-center gap-2">
                        <input type="hidden" name="shiftId" value={shift.id} />
                        <select name="staffId" className={`${inputClass} w-44 py-1.5 text-xs`}>
                          {activeStaff.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.firstName} {s.lastName}
                            </option>
                          ))}
                        </select>
                        <button
                          type="submit"
                          className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-700"
                        >
                          <Plus className="h-3.5 w-3.5" /> Offer
                        </button>
                      </form>
                    ) : (
                      <span className="text-xs text-slate-400">No active carers to offer to</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Pending offers ({pendingOffers.length})</h2>
          <p className="text-xs text-slate-500">Shown on the carer’s home screen. Withdraw any time.</p>
        </div>
        {pendingOffers.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No pending offers"
              description="Offer a shift above and it will land here until the carer responds."
            />
          </div>
        ) : (
          <table className="w-full min-w-[800px]">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Shift</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Offered to</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">When</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Offered</th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingOffers.map((offer) => (
                <tr key={offer.id} className="hover:bg-slate-50">
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">{offer.shift.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{offer.shift.role}</p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="font-medium text-slate-900">
                      {offer.staff.firstName} {offer.staff.lastName}
                    </p>
                  </td>
                  <td className="px-5 py-4">
                    <p className="tabular text-sm text-slate-700">
                      {formatDate(offer.shift.startAt)} · {formatTime(offer.shift.startAt)} –{" "}
                      {formatTime(offer.shift.endAt)}
                    </p>
                  </td>
                  <td className="px-5 py-4 text-sm text-slate-500">{formatDate(offer.offeredAt)}</td>
                  <td className="px-5 py-4 text-right">
                    <form action={withdrawOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <button
                        type="submit"
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
                      >
                        Withdraw
                      </button>
                    </form>
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