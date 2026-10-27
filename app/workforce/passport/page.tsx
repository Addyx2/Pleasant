import React from "react";
import { ShieldCheck, CheckCircle2, Clock, Award, FileText, UserCheck, Share2 } from "lucide-react";

export const metadata = {
  title: "Care Passport",
};

export default function WorkforcePassportPage() {
  const credentials = [
    { title: "Enhanced DBS Check", detail: "Registered with Update Service", status: "VERIFIED", expires: "Active" },
    { title: "Right to Work (UK)", detail: "Verified Share Code", status: "VERIFIED", expires: "Settled Status" },
    { title: "Moving & Handling of People", detail: "Practical & Theory Refresher", status: "VERIFIED", expires: "Expires in 8 mos" },
    { title: "Safeguarding Adults (Level 3)", detail: "CQC Mandatory Standard", status: "VERIFIED", expires: "Expires in 11 mos" },
    { title: "Basic Life Support & First Aid", detail: "Practical Resuscitation", status: "ACTION_REQUIRED", expires: "Renewal due in 28 days" },
  ];

  return (
    <div className="space-y-5 pb-8 font-sans">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold tracking-tight text-slate-900">Care Passport</h1>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
              CQC Verified
            </span>
          </div>
          <p className="text-xs text-slate-500">Universal portable compliance & career identity</p>
        </div>
        <button className="flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-xs hover:bg-slate-50">
          <Share2 className="h-3.5 w-3.5" /> Share
        </button>
      </div>

      {/* Verified Status Banner */}
      <div className="rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 p-5 text-white shadow-sm flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-5 w-5 text-emerald-200" />
            <span className="font-bold text-sm tracking-tight">Passport Status: 100% Compliant</span>
          </div>
          <p className="text-xs text-emerald-100 mt-1">Pre-cleared for agency & care home shifts across the UK network.</p>
        </div>
        <Award className="h-10 w-10 text-emerald-300/40 shrink-0" />
      </div>

      {/* Compliance Matrix */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Verified Credentials</h2>
        <div className="space-y-2">
          {credentials.map((c, i) => (
            <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-bold text-slate-900 text-xs">{c.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">{c.detail}</p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {c.expires}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    c.status === "VERIFIED"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : "bg-amber-50 text-amber-800 border border-amber-200"
                  }`}
                >
                  {c.status === "VERIFIED" ? "Verified ✓" : "Renew Soon"}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Verified References */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">Verified Employer References</h2>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs space-y-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-600 text-xs">
              <UserCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-xs">Sister Margaret O'Connor</p>
              <p className="text-[11px] text-slate-500">Clinical Lead · St. Andrew's Care Home</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 italic bg-slate-50 p-2.5 rounded-xl border border-slate-100 mt-2">
            "Extremely reliable, gentle with complex dementia residents, and always punctual."
          </p>
        </div>
      </div>
    </div>
  );
}
