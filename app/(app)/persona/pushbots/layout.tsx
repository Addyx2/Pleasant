import Link from "next/link";
import { Bot } from "lucide-react";

import { requireOps } from "@/lib/auth";

import { PushbotsTabs } from "./PushbotsTabs";

export default async function PushbotsLayout({ children }: { children: React.ReactNode }) {
  await requireOps();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
            <Bot className="h-4 w-4 text-brand-300" />
          </span>
          <div>
            <Link href="/persona" className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 hover:text-brand-700">
              Persona
            </Link>
            <h1 className="font-display text-xl font-bold leading-tight tracking-tight text-slate-900">Pushbots</h1>
            <p className="text-xs text-slate-500">Fills open shifts by text, and answers carers&apos; texts as them.</p>
          </div>
        </div>
        <PushbotsTabs />
      </div>
      {children}
    </div>
  );
}
