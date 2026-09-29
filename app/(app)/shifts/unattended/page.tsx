import { AlertTriangle, Bot, CalendarClock, Clock } from "lucide-react";
import { format } from "date-fns";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatTime } from "@/lib/utils";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { triageShiftAction } from "../actions";

export const metadata = {
  title: "Unattended Shifts | Pleasant",
};

export const dynamic = "force-dynamic";

async function activeCampaignCount(agencyId: string) {
  return prisma.pushbotCampaign.count({
    where: { agencyId, status: "RUNNING" },
  });
}

export default async function UnattendedShiftsPage() {
  const user = await requireAdmin();

  const [unattended, runningCampaigns] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId: user.agencyId, status: "UNATTENDED" },
      include: { client: true, site: true, pushbotCampaigns: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    activeCampaignCount(user.agencyId),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Unattended shifts"
        description="Missed check-ins and no-shows need immediate triage."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Critical unattended</p>
              <p className="text-2xl font-bold text-red-900">{unattended.length}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Shifts in triage</p>
              <p className="text-2xl font-bold text-emerald-900">{runningCampaigns}</p>
            </div>
          </div>
        </Card>
        <Card className="p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Shift starts</p>
              <p className="text-2xl font-bold text-slate-900">
                {unattended.length > 0 ? format(unattended[0].startAt, "HH:mm") : "—"}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card className="overflow-x-auto">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
          <h2 className="text-sm font-semibold text-slate-900">Needs a carer now</h2>
        </div>
        {unattended.length === 0 ? (
          <div className="p-5">
            <EmptyState
              title="No unattended shifts"
              description="When a shift misses a check-in, mark it UNATTENDED and triage it here."
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
                <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {unattended.map((shift) => {
                const running = shift.pushbotCampaigns[0];
                const active = running && running.status === "RUNNING";
                return (
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
                        {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
                        <Clock className="h-3 w-3" /> Updated {formatDate(shift.updatedAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      {active ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800 ring-1 ring-inset ring-emerald-600/15">
                          <Bot className="h-3 w-3" aria-hidden="true" />
                          Triaging · {running.offersSent} eligible carers
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800 ring-1 ring-inset ring-red-600/15">
                          <AlertTriangle className="h-3 w-3" aria-hidden="true" /> Unattended
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {active ? (
                        <span className="text-xs font-medium text-slate-400">Triaging…</span>
                      ) : (
                        <form action={triageShiftAction}>
                          <input type="hidden" name="shiftId" value={shift.id} />
                          <button
                            type="submit"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                          >
                            <Bot className="h-3.5 w-3.5" /> Start auto-triage
                          </button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}