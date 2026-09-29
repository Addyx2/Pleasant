import React from "react";
import { Play, FileCode2, Clock, CheckCircle2, XCircle, TerminalSquare } from "lucide-react";

export const metadata = {
  title: "Runners Task Queue | Agents",
};

export default function RunnersPage() {
  const tasks = [
    {
      id: "TSK-001",
      title: "SYNC_WFM_ROSTER",
      payload: "{ source: 'Workday', syncType: 'Delta' }",
      status: "COMPLETED",
      time: "2 mins ago",
    },
    {
      id: "TSK-002",
      title: "GENERATE_INVOICES",
      payload: "{ client: 'Metro Health', period: 'Sep 2026' }",
      status: "RUNNING",
      time: "Just now",
    },
    {
      id: "TSK-003",
      title: "NOTIFY_EXPIRING_CREDENTIALS",
      payload: "{ daysThreshold: 30 }",
      status: "PENDING",
      time: "Queued",
    }
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <Play className="h-6 w-6 text-brand-600" />
            Runners Task Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Monitor background jobs, data syncs, and autonomous operational tasks.
          </p>
        </div>
        <div className="flex gap-3">
          <button className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm ring-1 ring-inset ring-slate-300 hover:bg-slate-50">
            <TerminalSquare className="h-4 w-4" />
            Dispatch Custom Task
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Tasks in Queue</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">1</p>
        </div>
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-blue-800">Currently Running</p>
          <p className="mt-2 text-3xl font-bold text-blue-900 animate-pulse">1</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Completed Today</p>
          <p className="mt-2 text-3xl font-bold text-slate-900">1,204</p>
        </div>
      </div>

      <div className="bg-slate-900 rounded-xl shadow-xl border border-slate-800 overflow-hidden font-mono text-sm text-slate-300">
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center gap-2 text-slate-400">
            <FileCode2 className="h-4 w-4 text-brand-500" />
            <span>runners.execution.log</span>
          </div>
          <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
        </div>
        <div className="p-6 space-y-4">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-start gap-4">
              <span className="text-slate-500 min-w-[80px]">{task.time}</span>
              
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  {task.status === "COMPLETED" && <CheckCircle2 className="h-4 w-4 text-emerald-500" />}
                  {task.status === "RUNNING" && <Clock className="h-4 w-4 text-blue-400 animate-spin" />}
                  {task.status === "PENDING" && <Clock className="h-4 w-4 text-amber-500" />}
                  
                  <span className={`font-bold ${task.status === "COMPLETED" ? "text-emerald-400" : task.status === "RUNNING" ? "text-blue-400" : "text-amber-400"}`}>
                    [{task.status}]
                  </span>
                  <span className="text-white font-semibold">{task.title}</span>
                </div>
                <div className="text-slate-500 pl-6 border-l border-slate-800 ml-2 py-1">
                  payload: {task.payload}
                </div>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2 text-slate-500 pt-4">
            <span className="text-brand-500 font-bold">&gt;</span>
            <span className="animate-pulse">_ waiting for new tasks...</span>
          </div>
        </div>
      </div>
      
    </div>
  );
}
