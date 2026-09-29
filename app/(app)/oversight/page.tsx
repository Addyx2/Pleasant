import React from "react";
import { BarChart3, TrendingUp, Users, ShieldAlert, Bot, ArrowRight, CheckCircle2 } from "lucide-react";

export const metadata = {
  title: "Oversight Analytics | Pleasant",
};

export default function OversightPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-brand-600" />
            Oversight Analytics
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Platform performance, Pushbot triage metrics, and financial risk monitoring.
          </p>
        </div>
        <div className="flex gap-3">
          <select className="rounded-lg border-slate-300 py-2 pl-3 pr-8 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
            <option>Last 7 Days</option>
            <option>Last 30 Days</option>
            <option>This Month</option>
          </select>
          <button className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
            Export Report
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Pushbot Fill Rate</p>
            <Bot className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">92.4%</p>
          <p className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
            <TrendingUp className="mr-1 h-3 w-3" />
            +4.2% from last week
          </p>
        </div>
        
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Avg Time to Fill</p>
            <ClockIcon className="h-5 w-5 text-blue-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">4m 12s</p>
          <p className="mt-1 flex items-center text-xs text-emerald-600 font-medium">
            <TrendingUp className="mr-1 h-3 w-3" />
            -1m 45s faster
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Client Confidence (Avg)</p>
            <CheckCircle2 className="h-5 w-5 text-purple-500" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">4.8/5.0</p>
          <p className="mt-1 flex items-center text-xs text-slate-500">
            Across 14 active clients
          </p>
        </div>

        <div className="rounded-xl border border-red-100 bg-red-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-red-800">Unattended Shifts</p>
            <ShieldAlert className="h-5 w-5 text-red-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-red-900">3</p>
          <p className="mt-1 flex items-center text-xs text-red-700 font-medium">
            Requires immediate attention
          </p>
        </div>
      </div>

      {/* Analytics Panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-semibold text-slate-900">Pushbot Channel Performance</h3>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-600">WhatsApp Offers Sent</span>
                <span className="text-sm font-bold text-slate-900">1,240</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-emerald-500 h-2 rounded-full" style={{ width: "85%" }}></div>
              </div>
              
              <div className="flex items-center justify-between pt-2">
                <span className="text-sm font-medium text-slate-600">SMS Fallback Offers</span>
                <span className="text-sm font-bold text-slate-900">312</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2">
                <div className="bg-blue-500 h-2 rounded-full" style={{ width: "25%" }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h3 className="font-semibold text-slate-900">Financial Risk: Overtime Warnings</h3>
          </div>
          <div className="p-0">
            <ul className="divide-y divide-slate-100">
              <li className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
                <div>
                  <p className="font-medium text-slate-900">Sarah Jenkins (RN)</p>
                  <p className="text-xs text-slate-500">Currently at 38 hours this week</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                  Risk
                </span>
              </li>
              <li className="flex items-center justify-between p-4 hover:bg-slate-50 transition">
                <div>
                  <p className="font-medium text-slate-900">Marcus Cole (Security)</p>
                  <p className="text-xs text-slate-500">Currently at 41 hours this week</p>
                </div>
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-800">
                  Overtime
                </span>
              </li>
            </ul>
            <div className="border-t border-slate-200 p-4">
              <a href="#" className="flex items-center text-sm font-medium text-brand-600 hover:text-brand-700">
                View all workforce risks <ArrowRight className="ml-1 h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Simple clock icon component to avoid missing import
function ClockIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  );
}
