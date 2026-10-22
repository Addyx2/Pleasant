import { Sparkles } from "lucide-react";

import { requireOps } from "@/lib/auth";

import { AssistTabs } from "./AssistTabs";

export default async function AssistLayout({ children }: { children: React.ReactNode }) {
  await requireOps();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
            <Sparkles className="h-4 w-4 text-brand-300" />
          </span>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-900">Assist</h1>
            <p className="text-xs text-slate-500">Your AI assistant for Pleasant: ask, act, automate.</p>
          </div>
        </div>
        <AssistTabs />
      </div>
      {children}
    </div>
  );
}
