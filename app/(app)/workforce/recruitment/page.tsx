import React from "react";
import { UserPlus, ShieldCheck, GraduationCap, FileSignature, CheckCircle2, Clock, AlertTriangle, FileText } from "lucide-react";

export const metadata = {
  title: "Recruitment & Onboarding | Workforce",
};

export default function RecruitmentPage() {
  const candidates = [
    {
      id: "CAN-092",
      name: "Olivia Chen",
      role: "Registered Nurse (RN)",
      stage: "Right to Work",
      status: "Action Required",
      rtw: "Pending BRP Verification",
      training: "Not Started",
      forms: "Not Started",
    },
    {
      id: "CAN-093",
      name: "Marcus Johnson",
      role: "Care Assistant",
      stage: "Training",
      status: "In Progress",
      rtw: "Verified",
      training: "Manual Handling (Pending)",
      forms: "Submitted",
    },
    {
      id: "CAN-094",
      name: "Emma Davis",
      role: "Support Worker",
      stage: "Forms",
      status: "Under Review",
      rtw: "Verified",
      training: "Completed",
      forms: "Medical & Bank Details (Pending Review)",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <UserPlus className="h-6 w-6 text-brand-600" />
            Recruitment & Onboarding
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage candidate pipelines through Right To Work, Training, and Compliance Forms.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700">
            Invite Candidate
          </button>
        </div>
      </div>

      {/* Funnel KPI Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-slate-500">Active Candidates</p>
            <UserPlus className="h-5 w-5 text-slate-400" />
          </div>
          <p className="mt-2 text-3xl font-bold text-slate-900">14</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-blue-800">Right to Work Checks</p>
            <ShieldCheck className="h-5 w-5 text-blue-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-blue-900">5 Pending</p>
        </div>
        <div className="rounded-xl border border-purple-200 bg-purple-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-purple-800">Training Validation</p>
            <GraduationCap className="h-5 w-5 text-purple-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-purple-900">3 In Progress</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-amber-800">Forms & Compliance</p>
            <FileSignature className="h-5 w-5 text-amber-600" />
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-900">6 Under Review</p>
        </div>
      </div>

      {/* Candidate Pipeline Table */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Onboarding Pipeline</h3>
          <span className="text-xs font-semibold text-slate-500 bg-slate-200 px-2 py-1 rounded-full">Showing 3 Actionable</span>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-white">
              <tr>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Candidate</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Phase 1: Right To Work</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Phase 2: Training</th>
                <th className="px-6 py-3 text-left font-semibold text-slate-900">Phase 3: Forms</th>
                <th className="px-6 py-3 text-right font-semibold text-slate-900">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {candidates.map((cand) => (
                <tr key={cand.id} className="hover:bg-slate-50 transition">
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className="font-bold text-slate-900">{cand.name}</div>
                    <div className="text-slate-500">{cand.role}</div>
                  </td>
                  
                  {/* Right To Work Column */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className={`flex items-center gap-1.5 font-medium ${cand.rtw === 'Verified' ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {cand.rtw === 'Verified' ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                      {cand.rtw}
                    </div>
                  </td>
                  
                  {/* Training Column */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className={`flex items-center gap-1.5 font-medium ${cand.training === 'Completed' ? 'text-emerald-600' : cand.training === 'Not Started' ? 'text-slate-400' : 'text-blue-600'}`}>
                      {cand.training === 'Completed' ? <CheckCircle2 className="h-4 w-4" /> : cand.training === 'Not Started' ? <Clock className="h-4 w-4" /> : <GraduationCap className="h-4 w-4" />}
                      {cand.training}
                    </div>
                  </td>

                  {/* Forms Column */}
                  <td className="whitespace-nowrap px-6 py-4">
                    <div className={`flex items-center gap-1.5 font-medium ${cand.forms.includes('Review') ? 'text-amber-600' : cand.forms === 'Not Started' ? 'text-slate-400' : 'text-blue-600'}`}>
                      {cand.forms.includes('Review') ? <FileText className="h-4 w-4" /> : cand.forms === 'Not Started' ? <Clock className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                      {cand.forms}
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-6 py-4 text-right">
                    <button className="text-brand-600 hover:text-brand-800 font-semibold bg-brand-50 px-3 py-1.5 rounded transition">
                      Review & Approve
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
