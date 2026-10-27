"use client";

import React, { useState } from "react";
import { ShieldCheck, CalendarClock, Building2, CheckCircle2, FileText, Send, UserCheck, Clock, Receipt, CreditCard } from "lucide-react";

export default function SupplyPortal({ params }: { params: { token: string } }) {
  const [activeTab, setActiveTab] = useState<"overview" | "request" | "timesheets" | "invoices">("overview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clientName = "Metro Health Care Group";

  // Mock Request State
  const [requestRole, setRequestRole] = useState("Registered Nurse (RN)");
  const [requestDate, setRequestDate] = useState("");

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setTimeout(() => {
      alert(`Shift requested for ${requestRole}! Supply dispatch has queued your request.`);
      setIsSubmitting(false);
      setActiveTab("overview");
    }, 1000);
  };

  const handleSignOff = async (id: string) => {
    alert(`Timesheet ${id} digitally signed off! Verified hours approved.`);
  };

  const handlePayInvoice = (id: string) => {
    alert(`Redirecting to secure payment checkout for ${id}...`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("overview")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 shadow-md">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-slate-900">Supply Portal</h1>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
                Pleasant / Supply
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">{clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700 hidden sm:inline">Pleasant Link Verified</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 p-1 bg-slate-200/50 rounded-lg w-full">
          <button 
            onClick={() => setActiveTab("overview")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition ${activeTab === "overview" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            Live Overview
          </button>
          <button 
            onClick={() => setActiveTab("timesheets")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition ${activeTab === "timesheets" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            Sign-offs (2)
          </button>
          <button 
            onClick={() => setActiveTab("request")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition ${activeTab === "request" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            Request Shifts
          </button>
          <button 
            onClick={() => setActiveTab("invoices")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition ${activeTab === "invoices" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            Invoices & Billing
          </button>
        </div>

        {/* Live Overview Tab */}
        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Facility Staffing & Coverage</h2>
              <p className="text-slate-500 mt-1">Real-time status of agency workers placed at your sites today.</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6">
                <ul className="space-y-4">
                  <li className="flex items-center justify-between p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">JD</div>
                      <div>
                        <p className="font-bold text-slate-900">John Doe (RN)</p>
                        <p className="text-sm text-slate-500">ICU Ward 3 • 08:00 - 16:00 (On-Site)</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                      Clocked In
                    </span>
                  </li>
                  <li className="flex items-center justify-between p-4 rounded-xl border border-slate-100 bg-slate-50">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-600">MK</div>
                      <div>
                        <p className="font-bold text-slate-900">Mariam K. (HCA)</p>
                        <p className="text-sm text-slate-500">North Wing • 19:00 - 07:00 (Night Shift)</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                      Confirmed Tonight
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Timesheets Sign-off Tab */}
        {activeTab === "timesheets" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-brand-600" />
              Timesheets Requiring Client Sign-Off
            </h2>
            <p className="text-slate-500 text-sm">Review worked hours and authorise digital sign-off.</p>
            <div className="space-y-4">
              {[
                { id: "TS-1042", name: "Sarah Adams", role: "Care Assistant", date: "Yesterday, Oct 26", hours: "12.0 hrs (08:00–20:00)" },
                { id: "TS-1043", name: "Marcus Cole", role: "Support Worker", date: "Yesterday, Oct 26", hours: "8.0 hrs (08:00–16:00)" },
              ].map((ts) => (
                <div key={ts.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600">
                      <UserCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{ts.name} <span className="text-sm font-normal text-slate-500">({ts.role})</span></p>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="h-3.5 w-3.5" /> {ts.date} • {ts.hours}
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleSignOff(ts.id)} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition w-full sm:w-auto shadow-sm">
                    Sign Off & Approve
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Shift Requests Tab */}
        {activeTab === "request" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-brand-600" />
                Request Agency Shifts
              </h2>
            </div>
            <form onSubmit={handleRequestSubmit} className="p-6 space-y-5">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Required Role</label>
                  <select 
                    value={requestRole} onChange={(e) => setRequestRole(e.target.value)}
                    className="w-full rounded-lg border-slate-300 py-2.5 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white border"
                  >
                    <option>Registered Nurse (RN)</option>
                    <option>Senior Care Assistant</option>
                    <option>Healthcare Assistant (HCA)</option>
                    <option>Support Worker</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Start Date/Time</label>
                    <input type="datetime-local" className="w-full rounded-lg border-slate-300 py-2 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white border" required />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">End Date/Time</label>
                    <input type="datetime-local" className="w-full rounded-lg border-slate-300 py-2 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white border" required />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Site / Ward Location</label>
                  <input type="text" placeholder="e.g. ICU Ward 3, High Dependency Unit" className="w-full rounded-lg border-slate-300 py-2 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white border" />
                </div>
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isSubmitting ? "Queueing Shift Order..." : "Submit Shift Order to Supply Desk"}
                {!isSubmitting && <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}

        {/* Invoices & Billing Tab */}
        {activeTab === "invoices" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div>
              <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                <Receipt className="h-6 w-6 text-brand-600" />
                Invoices & Payment
              </h2>
              <p className="text-slate-500 text-sm mt-1">Review approved timesheet billings and pay invoices directly.</p>
            </div>

            <div className="space-y-4">
              {[
                { id: "INV-2026-081", period: "19 Oct – 25 Oct 2026", hours: "48.0 hrs", total: "£1,248.00", status: "DUE", due: "Due in 7 days" },
                { id: "INV-2026-074", period: "12 Oct – 18 Oct 2026", hours: "36.5 hrs", total: "£949.00", status: "PAID", due: "Paid 20 Oct" },
              ].map((inv) => (
                <div key={inv.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-slate-900">{inv.id}</p>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${inv.status === "DUE" ? "bg-amber-50 text-amber-800 border border-amber-200" : "bg-emerald-50 text-emerald-800 border border-emerald-200"}`}>
                        {inv.status}
                      </span>
                    </div>
                    <p className="text-sm text-slate-500 mt-0.5">{inv.period} · {inv.hours}</p>
                    <p className="text-xs text-slate-400 mt-1">{inv.due}</p>
                  </div>

                  <div className="flex items-center gap-4">
                    <p className="text-lg font-bold text-slate-900">{inv.total}</p>
                    {inv.status === "DUE" ? (
                      <button onClick={() => handlePayInvoice(inv.id)} className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition flex items-center gap-1.5 shadow-sm">
                        <CreditCard className="h-4 w-4" /> Pay Now
                      </button>
                    ) : (
                      <button className="text-slate-600 hover:text-slate-900 text-sm font-medium border border-slate-200 px-3 py-1.5 rounded-lg">
                        Download PDF
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <footer className="py-6 text-center text-xs text-slate-500">
        Supply Platform • Secure Portal powered by Pleasant / Aultrum
      </footer>
    </div>
  );
}
