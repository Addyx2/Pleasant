"use client";

import React, { useState } from "react";
import { format } from "date-fns";
import { PenTool, CheckCircle2 } from "lucide-react";
import { StatusBadge } from "@/components/status";
import { formatCurrency } from "@/lib/utils";
import { SignOffModal } from "./SignOffModal";

interface TimesheetRowProps {
  timesheet: {
    id: string;
    clockIn: string | Date;
    clockOut: string | Date | null;
    workedMins: number;
    status: string;
    expenses: string | number;
    clientAuthAt: string | Date | null;
    clientAuthName: string | null;
    shift: {
      title: string;
      client?: { firstName: string; lastName: string } | null;
      site?: { name: string } | null;
    };
  };
}

export function TimesheetRow({ timesheet }: TimesheetRowProps) {
  const [isSignOffOpen, setIsSignOffOpen] = useState(false);
  const [signedLocally, setSignedLocally] = useState(false);

  const where =
    timesheet.shift.client != null
      ? `${timesheet.shift.client.firstName} ${timesheet.shift.client.lastName}`
      : (timesheet.shift.site?.name ?? "Location TBC");

  const clockInDate = new Date(timesheet.clockIn);
  const isClockedOut = Boolean(timesheet.clockOut);
  const isSigned = Boolean(timesheet.clientAuthAt) || signedLocally;

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-slate-300">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-900">{timesheet.shift.title}</p>
          <p className="mt-0.5 text-sm text-slate-600">{where}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            {format(clockInDate, "EEE d MMM")} ·{" "}
            {timesheet.workedMins > 0
              ? `${(timesheet.workedMins / 60).toFixed(1)} h worked`
              : "not clocked out"}
          </p>
          {Number(timesheet.expenses) > 0 ? (
            <p className="mt-0.5 text-xs font-medium text-slate-600">
              Expenses {formatCurrency(Number(timesheet.expenses))}
            </p>
          ) : null}
        </div>
        <StatusBadge status={signedLocally ? "APPROVED" : timesheet.status} />
      </div>

      {/* On-Glass Sign-Off Action for Agency Shifts */}
      {isClockedOut && !isSigned && (
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
          <span className="text-[11px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-medium">
            Requires Site Signature
          </span>
          <button
            onClick={() => setIsSignOffOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-bold text-white shadow-xs hover:bg-slate-800 transition"
          >
            <PenTool className="h-3.5 w-3.5" /> Client Sign-Off
          </button>
        </div>
      )}

      {isSigned && (
        <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
          <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          <span>Signed off on-site by client</span>
        </div>
      )}

      <SignOffModal
        timesheetId={timesheet.id}
        shiftTitle={timesheet.shift.title}
        clientName={where}
        hoursWorked={`${(timesheet.workedMins / 60).toFixed(1)} hrs`}
        isOpen={isSignOffOpen}
        onClose={() => setIsSignOffOpen(false)}
        onSuccess={() => setSignedLocally(true)}
      />
    </div>
  );
}
