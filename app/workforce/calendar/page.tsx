import React from "react";
import { CalendarRange, ChevronLeft, ChevronRight, Clock, Plus, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Master Calendar",
};

export default function WorkforceCalendarPage() {
  const events = [
    {
      id: "ev-1",
      date: "Today, 27 Oct",
      time: "08:00 – 16:00",
      type: "SHIFT",
      title: "ICU Day Cover",
      org: "Apex Healthcare (Pleasant)",
      status: "CONFIRMED",
    },
    {
      id: "ev-2",
      date: "Tomorrow, 28 Oct",
      time: "All Day",
      type: "UNAVAILABLE",
      title: "Declared Availability: Off",
      org: "Personal Availability Block",
      status: "PROTECTED",
    },
    {
      id: "ev-3",
      date: "Fri, 31 Oct",
      time: "19:00 – 07:00",
      type: "SHIFT",
      title: "Night Duty (Bank)",
      org: "Sunrise Care Group (Flowstate)",
      status: "CONFIRMED",
    },
  ];

  return (
    <div className="space-y-5 pb-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900">Master Calendar</h1>
          <p className="text-xs text-slate-500">Cross-organisation schedule & conflict shield</p>
        </div>
        <button className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-xs">
          <Plus className="h-3.5 w-3.5" /> Book Holiday
        </button>
      </div>

      {/* Mini Month Strip */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-700">October 2026</span>
          <div className="flex items-center gap-1 text-slate-400">
            <button className="p-1 hover:text-slate-900"><ChevronLeft className="h-4 w-4" /></button>
            <button className="p-1 hover:text-slate-900"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
            <span key={i} className="text-[11px] font-semibold text-slate-400">{d}</span>
          ))}
          {[26, 27, 28, 29, 30, 31, 1].map((day, idx) => (
            <div
              key={idx}
              className={`py-2 rounded-xl text-xs font-medium ${
                day === 27
                  ? "bg-slate-900 text-white font-bold"
                  : day === 28
                  ? "bg-amber-50 text-amber-800 border border-amber-200"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </div>

      {/* Conflict Shield Notice */}
      <div className="flex items-center gap-2.5 rounded-2xl bg-emerald-50 px-4 py-3 border border-emerald-100 text-emerald-800 text-xs">
        <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-600" />
        <span>Double-booking shield active across all linked agencies and homes.</span>
      </div>

      {/* Upcoming Diary List */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Scheduled Days</h2>
        {events.map((ev) => (
          <div key={ev.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold tracking-wide uppercase px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                  {ev.type}
                </span>
                <p className="font-bold text-slate-900 mt-1 text-sm">{ev.title}</p>
                <p className="text-xs text-slate-500 mt-0.5">{ev.org}</p>
              </div>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ev.status === "CONFIRMED" ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700"}`}>
                {ev.status}
              </span>
            </div>
            <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {ev.time}</span>
              <span className="font-medium text-slate-700">{ev.date}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
