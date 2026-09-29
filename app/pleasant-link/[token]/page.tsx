import { Building2, Clock, FileText, ShieldCheck, UserPlus } from "lucide-react";
import { endOfDay, startOfDay } from "date-fns";

import { prisma } from "@/lib/db";
import { validatePleasantLink } from "@/lib/clientpoint/pleasant-link";
import { formatDate, formatHours, formatTime } from "@/lib/utils";
import { Card } from "@/components/ui";
import { RequestStaffForm } from "@/components/clientpoint/RequestStaffForm";
import { SignOffForm } from "@/components/clientpoint/SignOffForm";

export const dynamic = "force-dynamic";

export default async function PleasantLinkPortal({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  let link;
  try {
    link = await validatePleasantLink(token);
  } catch (e) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
        <Card className="max-w-md p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-slate-300" />
          <h1 className="font-display mt-4 text-xl font-bold text-slate-900">Link not available</h1>
          <p className="mt-2 text-sm text-slate-500">
            {e instanceof Error ? e.message : "This secure link is invalid or has expired."}
            <br />
            Please contact your agency for a new one.
          </p>
        </Card>
      </div>
    );
  }

  const { client, agency } = link;
  const today = new Date();
  const dayStart = startOfDay(today);
  const dayEnd = endOfDay(today);

  const [pending, onSite, onSiteCount, recentLedger] = await Promise.all([
    prisma.timesheet.findMany({
      where: { agencyId: agency.id, status: "PENDING", shift: { clientId: client.id } },
      include: { shift: true, staff: true },
      orderBy: { clockIn: "asc" },
      take: 15,
    }),
    prisma.shift.findMany({
      where: { agencyId: agency.id, clientId: client.id, startAt: { gte: dayStart, lte: dayEnd }, status: { in: ["ASSIGNED", "IN_PROGRESS"] } },
      include: { staff: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.shift.count({
      where: { agencyId: agency.id, clientId: client.id, startAt: { gte: dayStart, lte: dayEnd }, status: { not: "CANCELLED" } },
    }),
    prisma.shift.findMany({
      where: { agencyId: agency.id, clientId: client.id, status: "COMPLETED" },
      include: { staff: true },
      orderBy: { startAt: "desc" },
      take: 6,
    }),
  ]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 px-6 py-4 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800">
              <Building2 className="h-5 w-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-slate-900">{client.firstName} {client.lastName}</h1>
              <p className="text-xs text-slate-500">via {agency.name} · Pleasant Link</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> Secure portal
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-4xl space-y-6 p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">On site today</p>
                <p className="text-2xl font-bold text-slate-900">{onSiteCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-100 text-amber-700">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Pending sign-offs</p>
                <p className="text-2xl font-bold text-slate-900">{pending.length}</p>
              </div>
            </div>
          </Card>
          <Card className="p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-100 text-brand-700">
                <UserPlus className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Request staff</p>
                <p className="text-xs text-slate-500">New shift opens instantly</p>
              </div>
            </div>
          </Card>
        </div>

        <Card>
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
            <Clock className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">On site today</h2>
          </div>
          <div className="p-5">
            {onSite.length === 0 ? (
              <p className="text-sm text-slate-500">No shifts scheduled for your site today.</p>
            ) : (
              <ul className="space-y-3">
                {onSite.map((shift) => (
                  <li key={shift.id} className="flex items-center justify-between gap-3 text-sm">
                    <div>
                      <p className="font-medium text-slate-900">{shift.title}</p>
                      <p className="text-xs text-slate-500">
                        {formatTime(shift.startAt)} – {formatTime(shift.endAt)}
                        {shift.staff ? ` · ${shift.staff.firstName} ${shift.staff.lastName}` : " · unassigned"}
                      </p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">
                      {shift.status === "IN_PROGRESS" ? "On shift" : "Assigned"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
            <FileText className="h-4 w-4 text-amber-600" />
            <h2 className="text-sm font-semibold text-slate-900">Approve timesheets</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pending.length === 0 ? (
              <p className="p-5 text-sm text-slate-500">Nothing waiting for your sign-off. Timesheets appear here once a shift is done.</p>
            ) : (
              pending.map((ts) => (
                <div key={ts.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                  <SignOffForm
                    token={token}
                    timesheetId={ts.id}
                    clientName={`${client.firstName} ${client.lastName}`}
                    staffName={`${ts.staff.firstName} ${ts.staff.lastName}`}
                    roleTitle={ts.shift.title}
                    dateLabel={formatDate(ts.clockIn)}
                    hoursLabel={formatHours(ts.workedMins)}
                  />
                </div>
              ))
            )}
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
            <UserPlus className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Request staff</h2>
          </div>
          <div className="p-5">
            <p className="mb-4 text-sm text-slate-500">
              Submit a staffing order for a new shift. Your agency manager sees it as an open shift
              ready to be matched with the next available carer.
            </p>
            <RequestStaffForm token={token} />
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-2.5 border-b border-slate-200 px-5 py-4">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <h2 className="text-sm font-semibold text-slate-900">Recent work ledger</h2>
          </div>
          <div className="p-5">
            {recentLedger.length === 0 ? (
              <p className="text-sm text-slate-500">Completed shifts will appear here as a proof-of-work record.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {recentLedger.map((shift) => (
                  <li key={shift.id} className="flex items-center justify-between gap-3">
                    <span className="font-medium text-slate-800">{shift.title}</span>
                    <span className="text-xs text-slate-500">
                      {formatDate(shift.startAt)} · {shift.staff ? `${shift.staff.firstName} ${shift.staff.lastName}` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </main>

      <footer className="py-6 text-center text-xs text-slate-400">
        Powered by Pleasant — {agency.name}. This link expires in 24 hours.
      </footer>
    </div>
  );
}