import { format } from "date-fns";
import type { Client, Shift, Site, Timesheet } from "@prisma/client";

import { saveCandidateSignatureAction, saveClientAuthAction } from "@/app/(app)/timesheets/actions";
import { SignOffForm } from "@/components/SignOffForm";
import { StatusBadge } from "@/components/status";
import { clientName } from "@/lib/clients";
import { formatCurrency } from "@/lib/utils";

type Row = Timesheet & { shift: Shift & { client: Client | null; site: Site | null } };

/** One timesheet, with the next sign-off step: the carer's own, then the client's. */
export function TimesheetRow({ timesheet: ts }: { timesheet: Row }) {
  const where = ts.shift.client ? clientName(ts.shift.client) : (ts.shift.site?.name ?? "Location to be confirmed");
  const subtitle = `${ts.shift.title} · ${format(ts.clockIn, "EEE d MMM")} · ${where}`;
  // Sign-off only matters while the timesheet is waiting to be approved.
  const open = ts.status === "PENDING" && !ts.clientAuthAt;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{ts.shift.title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{where}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {format(ts.clockIn, "EEE d MMM")} · {ts.workedMins > 0 ? `${(ts.workedMins / 60).toFixed(1)} h worked` : "not clocked out"}
          </p>
          {Number(ts.expenses) > 0 ? <p className="mt-0.5 text-xs font-medium text-slate-600">Expenses {formatCurrency(Number(ts.expenses))}</p> : null}
        </div>
        <StatusBadge status={ts.status} />
      </div>

      {open && ts.clockOut && !ts.candidateSignedAt ? (
        <div className="mt-4 border-t border-slate-100 pt-3">
          <SignOffForm timesheetId={ts.id} mode="candidate" action={saveCandidateSignatureAction} buttonLabel="Sign off this shift" title="Sign off this shift" subtitle={subtitle} />
        </div>
      ) : null}
      {open && ts.candidateSignedAt ? (
        <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-medium text-amber-800">You&apos;ve signed off. Now get your client&apos;s signature.</p>
          <SignOffForm timesheetId={ts.id} mode="client" action={saveClientAuthAction} buttonLabel="Get client's signature" title="Client sign-off" subtitle={subtitle} />
        </div>
      ) : null}
      {ts.clientAuthAt ? (
        <p className="mt-3 border-t border-slate-100 pt-2.5 text-xs font-semibold text-emerald-700">
          Signed off by {ts.clientAuthName ?? "the client"}{ts.clientAuthPosition ? `, ${ts.clientAuthPosition}` : ""} · {format(ts.clientAuthAt, "d MMM, HH:mm")}
        </p>
      ) : null}
    </div>
  );
}
