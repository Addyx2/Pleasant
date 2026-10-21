import Link from "next/link";
import { CalendarClock, Clock, Plus, UserCheck, Users } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime, formatTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader, inputClass } from "@/components/ui";
import { offerShiftAction, withdrawOfferAction } from "./actions";
import { approveShiftRequestAction, rejectShiftRequestAction } from "@/app/(app)/shifts/requests/actions";
import { clientName } from "@/lib/clients";

export const metadata = {
  title: "Dispatch",
};

export const dynamic = "force-dynamic";

const TABS = [
  { id: "to-cover", label: "To cover" },
  { id: "offers", label: "Offers" },
  { id: "requests", label: "Requests" },
] as const;

const REQUEST_BANNERS: Record<string, { tone: "good" | "bad"; text: string }> = {
  approved: { tone: "good", text: "Request approved — carer assigned to the shift." },
  rejected: { tone: "bad", text: "Request declined." },
  taken: { tone: "bad", text: "That shift was already filled." },
};

export default async function DispatchPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; result?: string }>;
}) {
  const user = await requireOps();
  const { tab = "to-cover", result } = await searchParams;
  const activeTab = TABS.some((t) => t.id === tab) ? (tab as "to-cover" | "offers" | "requests") : "to-cover";
  const requestBanner = result != null && result in REQUEST_BANNERS ? REQUEST_BANNERS[result] : null;

  const [activeStaff, pendingOffers, acceptedOffers, unfilledShifts, pendingRequests] = await Promise.all([
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }],
      select: { id: true, firstName: true, lastName: true, jobTitle: true },
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
    prisma.shiftRequest.findMany({
      where: { agencyId: user.agencyId, status: "PENDING" },
      include: {
        shift: { include: { client: true, site: true } },
        staff: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const staffById = new Map(activeStaff.map((s) => [s.id, s]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Dispatch"
        description="The single home for assigning shifts. Offer, assign or approve requests."
      />

      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={`/dispatch?tab=${t.id}`}
            className={
              t.id === activeTab
                ? "rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            }
          >
            {t.label}
            {t.id === "requests" && pendingRequests.length > 0 ? (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-100 px-1.5 text-[10px] font-semibold text-amber-800">
                {pendingRequests.length}
              </span>
            ) : null}
          </Link>
        ))}
      </div>

      {requestBanner ? (
        <div
          className={
            requestBanner.tone === "good"
              ? "rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              : "rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          }
        >
          {requestBanner.text}
        </div>
      ) : null}

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

      {activeTab === "to-cover" ? (
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
                        {clientName(shift.client, "No client")}
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
      ) : null}

      {activeTab === "offers" ? (
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
                        {formatDate(offer.shift.startAt)} · {formatTime(offer.shift.startAt)} – {formatTime(offer.shift.endAt)}
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
      ) : null}

      {activeTab === "requests" ? (
        <Card className="overflow-x-auto">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
            <div className="flex items-center gap-2.5">
              <h2 className="text-sm font-semibold text-slate-900">Carer requests ({pendingRequests.length})</h2>
              <p className="text-xs text-slate-500">Approve to assign automatically</p>
            </div>
            <Link href="/shifts" className="text-xs font-medium text-brand-700 hover:underline">
              View all shifts
            </Link>
          </div>
          {pendingRequests.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title="No pending requests"
                description="When carers request an open shift, it will show here."
              />
            </div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Shift</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Client & site</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">When</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Requested by</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Message</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pendingRequests.map((req) => {
                  const where =
                    req.shift.client != null
                      ? clientName(req.shift.client)
                      : (req.shift.site?.name ?? "Location TBC");
                  return (
                    <tr key={req.id} className="hover:bg-slate-50">
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{req.shift.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{req.shift.role}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">{where}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="tabular text-sm text-slate-700">{formatDateTime(req.shift.startAt)}</p>
                      </td>
                      <td className="px-5 py-4">
                        <p className="font-medium text-slate-900">
                          {req.staff.firstName} {req.staff.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{req.staff.jobTitle}</p>
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600">{req.message ? `“${req.message}”` : "—"}</td>
                      <td className="px-5 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <form action={approveShiftRequestAction}>
                            <input type="hidden" name="requestId" value={req.id} />
                            <button
                              type="submit"
                              className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-700"
                            >
                              Approve & assign
                            </button>
                          </form>
                          <form action={rejectShiftRequestAction}>
                            <input type="hidden" name="requestId" value={req.id} />
                            <button
                              type="submit"
                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
                            >
                              Decline
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>
      ) : null}
    </div>
  );
}
