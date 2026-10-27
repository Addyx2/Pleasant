import React from "react";
import { Sparkles, CreditCard, ArrowUpRight, Flame, Gift, ShieldCheck } from "lucide-react";

export const metadata = {
  title: "Peak Rewards & Wallet",
};

export default function WorkforcePeakPage() {
  return (
    <div className="space-y-5 pb-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Peak Wallet</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-brand-50 text-brand-700 border border-brand-200">
              Revolut Rails
            </span>
          </div>
          <p className="text-xs text-slate-500">Earn, save & spend care incentives</p>
        </div>
      </div>

      {/* Main Balance Card */}
      <div className="rounded-3xl bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800 p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-10">
          <Sparkles className="h-32 w-32" />
        </div>
        <p className="text-xs font-medium text-slate-400">Total Peak Rewards</p>
        <div className="mt-2 flex items-baseline gap-3">
          <span className="text-3xl font-extrabold tracking-tight">3,450</span>
          <span className="text-sm font-semibold text-brand-400">pts</span>
          <span className="text-slate-500">·</span>
          <span className="text-xl font-bold text-emerald-400">£34.50</span>
        </div>

        <div className="mt-6 flex gap-3">
          <button className="flex-1 rounded-xl bg-white text-slate-950 py-2.5 text-xs font-bold transition hover:bg-slate-100 flex items-center justify-center gap-1 shadow-sm">
            <ArrowUpRight className="h-3.5 w-3.5" /> Cash Out to Card
          </button>
          <button className="rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-white/20 flex items-center gap-1.5">
            <Gift className="h-3.5 w-3.5" /> Perks
          </button>
        </div>
      </div>

      {/* Streak Multiplier */}
      <div className="flex items-center justify-between rounded-2xl bg-amber-50 p-4 border border-amber-200 text-amber-950">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-700">
            <Flame className="h-5 w-5" />
          </div>
          <div>
            <p className="font-bold text-xs">5-Shift On-Time Streak 🔥</p>
            <p className="text-[11px] text-amber-800">1.5x points multiplier active this weekend</p>
          </div>
        </div>
        <span className="text-xs font-extrabold text-amber-900">+50%</span>
      </div>

      {/* Virtual Card Preview */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-slate-700" />
            <span className="font-bold text-slate-900 text-sm">Aultrum Virtual Card</span>
          </div>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            Apple Pay Ready
          </span>
        </div>
        <div className="rounded-xl bg-slate-900 p-4 text-white text-xs font-mono space-y-3">
          <div className="flex justify-between items-center text-slate-400">
            <span>Aultrum Stare</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <p className="tracking-widest text-sm pt-2">•••• •••• •••• 8402</p>
          <div className="flex justify-between items-center text-[10px] text-slate-400 pt-1">
            <span>CARE PROFESSIONAL</span>
            <span>EXP 09/29</span>
          </div>
        </div>
      </div>

      {/* Reward History */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Recent Points Earned</h2>
        <div className="space-y-2">
          {[
            { title: "Completed Emergency Night Shift", org: "Apex Healthcare", pts: "+400 pts", date: "Yesterday" },
            { title: "Client Praise Note (Kind & Punctual)", org: "St Andrew's Care Home", pts: "+250 pts", date: "24 Oct" },
            { title: "Timesheet Signed Off in Under 2 hrs", org: "Apex Healthcare", pts: "+100 pts", date: "22 Oct" },
          ].map((item, idx) => (
            <div key={idx} className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-3.5 shadow-xs">
              <div>
                <p className="font-bold text-slate-900 text-xs">{item.title}</p>
                <p className="text-[11px] text-slate-500">{item.org} · {item.date}</p>
              </div>
              <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                {item.pts}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
