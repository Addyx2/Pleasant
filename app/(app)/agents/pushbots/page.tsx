import React from "react";
import { Bot, MessageSquare, CheckCircle, Clock, Zap, ExternalLink, Activity } from "lucide-react";

export const metadata = {
  title: "Pushbots Dashboard | Agents",
};

export default function PushbotsPage() {
  const activeCampaigns = [
    {
      id: "CMP-492",
      role: "Registered Nurse (RN)",
      shiftId: "SHF-8402",
      channel: "WhatsApp",
      status: "Running",
      sent: 14,
      replies: 2,
      timeElapsed: "4m 12s",
    },
    {
      id: "CMP-493",
      role: "Care Assistant",
      shiftId: "SHF-8405",
      channel: "SMS / Twilio",
      status: "Running",
      sent: 8,
      replies: 0,
      timeElapsed: "1m 30s",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Bot className="h-6 w-6 text-emerald-500" />
            Pushbots Triage
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor autonomous messaging campaigns and shift outreach.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-700">
            <Zap className="h-4 w-4" />
            Manual Broadcast
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm flex flex-col">
          <p className="text-sm font-medium text-emerald-800">Active Campaigns</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-3xl font-bold text-emerald-900">2</span>
            <span className="text-sm text-emerald-600 font-semibold animate-pulse">Running</span>
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Offers Sent Today</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">142</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Shifts Filled</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">12</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Avg Response Time</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">3m 40s</p>
        </div>
      </div>

      {/* Active Campaigns Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
          <Activity className="h-4 w-4 text-emerald-600" />
          <h3 className="font-bold text-slate-900">Live Outreach Campaigns</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Campaign / Target</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Channel</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Offers Sent</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Time Elapsed</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {activeCampaigns.map((camp) => (
                <tr key={camp.id} className="hover:bg-slate-50 transition">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="font-medium text-slate-900">{camp.id} • {camp.shiftId}</div>
                    <div className="text-slate-500">{camp.role}</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="flex items-center gap-1.5 text-slate-700 font-medium">
                      <MessageSquare className="h-4 w-4 text-emerald-500" />
                      {camp.channel}
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="text-slate-900 font-semibold">{camp.sent} Sent</div>
                    <div className="text-slate-500 text-xs">{camp.replies} replies pending processing</div>
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-amber-600 font-medium flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {camp.timeElapsed}
                  </td>
                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button className="text-brand-600 hover:text-brand-800 font-medium inline-flex items-center gap-1">
                      View Logs <ExternalLink className="h-3 w-3" />
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
