"use client";

import React, { useState } from "react";
import { ShieldCheck, CalendarClock, Building2, CheckCircle2, FileText, Send, UserCheck, Clock } from "lucide-react";
// In a real app, these would be imported from the server actions file:
// import { signOffTimesheet, requestShifts } from "@/lib/clientpoint/actions";

export default function PleasantLinkPortal({ params }: { params: { token: string } }) {
  const [activeTab, setActiveTab] = useState<"overview" | "request" | "timesheets">("overview");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const clientName = "Metro Health";

  // Mock Request State
  const [requestRole, setRequestRole] = useState("Registered Nurse (RN)");
  const [requestDate, setRequestDate] = useState("");

  const handleRequestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    // await requestShifts(params.token, requestRole, new Date(requestDate), ...);
    setTimeout(() => {
      alert(`Shift requested for ${requestRole}! Pushbots are triaging now.`);
      setIsSubmitting(false);
      setActiveTab("overview");
    }, 1000);
  };

  const handleSignOff = async (id: string) => {
    // await signOffTimesheet(params.token, id, "Site Manager", "Manager");
    alert(`Timesheet ${id} digitally signed off! Invoice generated.`);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b border-slate-200 py-4 px-6 flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveTab("overview")}>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-brand-600 to-brand-800 shadow-md">
            <Building2 className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Clientpoint Portal</h1>
            <p className="text-xs text-slate-500 font-medium">{clientName}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
          <ShieldCheck className="h-4 w-4 text-emerald-600" />
          <span className="text-xs font-semibold text-emerald-700 hidden sm:inline">Pleasant Link Secure</span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl w-full mx-auto p-6 space-y-8">
        
        {/* Navigation Tabs */}
        <div className="flex gap-2 p-1 bg-slate-200/50 rounded-lg w-full sm:w-max">
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
            Pending Sign-offs (2)
          </button>
          <button 
            onClick={() => setActiveTab("request")}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition ${activeTab === "request" ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            Request Staff
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Welcome back, Site Manager.</h2>
              <p className="text-slate-500 mt-1">Here is your live facility coverage for today.</p>
            </div>
            
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6">
                <ul className="space-y-4">
                  <li className="flex items-center justify-between p-4 rounded-xl border border-emerald-100 bg-emerald-50/50">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center font-bold text-emerald-700">JD</div>
                      <div>
                        <p className="font-bold text-slate-900">John Doe (RN)</p>
                        <p className="text-sm text-slate-500">ICU Ward 3 • 08:00 - 16:00</p>
                      </div>
                    </div>
                    <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 mr-2 animate-pulse"></span>
                      On Site Now
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {activeTab === "timesheets" && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <CheckCircle2 className="h-6 w-6 text-brand-600" />
              Timesheets Requiring Sign-off
            </h2>
            <div className="space-y-4">
              {[
                { id: "TS-1042", name: "Sarah Adams", role: "Care Assistant", date: "Sep 28, 2026", hours: "12 hrs" },
                { id: "TS-1043", name: "Marcus Cole", role: "Security Officer", date: "Sep 28, 2026", hours: "8 hrs" },
              ].map((ts) => (
                <div key={ts.id} className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600"><UserCheck className="h-5 w-5" /></div>
                    <div>
                      <p className="font-bold text-slate-900">{ts.name} <span className="text-sm font-normal text-slate-500">({ts.role})</span></p>
                      <p className="text-sm text-slate-500 flex items-center gap-1 mt-1">
                        <Clock className="h-3.5 w-3.5" /> {ts.date} • {ts.hours} tracked
                      </p>
                    </div>
                  </div>
                  <button onClick={() => handleSignOff(ts.id)} className="bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-lg text-sm font-semibold transition w-full sm:w-auto">
                    Approve & Sign Off
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "request" && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <CalendarClock className="h-5 w-5 text-blue-600" />
                Submit New Staffing Request
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
                    <option>Care Assistant</option>
                    <option>Support Worker</option>
                    <option>Security Officer</option>
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
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Site / Location Details</label>
                  <input type="text" placeholder="e.g. ICU Ward 3, North Building" className="w-full rounded-lg border-slate-300 py-2 px-3 text-sm focus:border-brand-500 focus:ring-1 focus:ring-brand-500 bg-white border" />
                </div>
              </div>
              <button 
                type="submit" disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white py-3 rounded-lg text-sm font-bold flex items-center justify-center gap-2 transition disabled:opacity-50"
              >
                {isSubmitting ? "Processing..." : "Submit Request & Trigger Pushbots"}
                {!isSubmitting && <Send className="h-4 w-4" />}
              </button>
            </form>
          </div>
        )}

      </main>
      <footer className="py-6 text-center text-xs text-slate-500">
        Powered by Aultrum / Pleasant Super Platform • Token: {params.token.slice(0, 8)}...
      </footer>
    </div>
  );
}
