import React from "react";
import { AlertTriangle, Bot, Clock, Search, ShieldAlert, ArrowRight } from "lucide-react";
import Link from "next/link";

export const metadata = {
  title: "Unattended Shifts | Pleasant",
};

export default function UnattendedShiftsPage() {
  // Mock data for UI demonstration
  const unattendedShifts = [
    {
      id: "SHF-8402",
      role: "Registered Nurse (RN)",
      client: "Metro Health",
      location: "ICU Ward 3",
      time: "Today, 08:00 - 16:00",
      unattendedSince: "08:15 AM",
      status: "🚨 Escalated",
      action: "Triage Required",
    },
    {
      id: "SHF-8405",
      role: "Care Assistant",
      client: "St. Jude Care Home",
      location: "North Wing",
      time: "Today, 09:00 - 17:00",
      unattendedSince: "09:10 AM",
      status: "🤖 Pushbot Active",
      action: "Triage In Progress",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-red-500" />
            Unattended Shifts
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Immediate attention required for late check-ins and no-shows.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            <Search className="h-4 w-4" />
            Search
          </button>
          <button className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700">
            <Bot className="h-4 w-4" />
            Bulk Triage via Pushbots
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 text-red-600">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-red-800">Critical Unattended</p>
              <p className="text-2xl font-bold text-red-900">2</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-600">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-emerald-800">Active Triage (Pushbots)</p>
              <p className="text-2xl font-bold text-emerald-900">1</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600">Avg Time to Resolve</p>
              <p className="text-2xl font-bold text-slate-900">14m</p>
            </div>
          </div>
        </div>
      </div>

      {/* Shifts Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Shift Details</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Client & Location</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Time / Unattended Since</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Status</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {unattendedShifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-slate-50 transition">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="font-medium text-slate-900">{shift.id}</div>
                    <div className="text-slate-500">{shift.role}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="font-medium text-slate-900">{shift.client}</div>
                    <div className="text-slate-500">{shift.location}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-slate-900">{shift.time}</div>
                    <div className="flex items-center gap-1 text-red-600 font-medium mt-0.5">
                      <Clock className="h-3 w-3" />
                      Since {shift.unattendedSince}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        shift.status.includes("Pushbot")
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {shift.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button className="inline-flex items-center gap-1.5 rounded bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand-700 hover:bg-brand-100 transition">
                      {shift.action} <ArrowRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
