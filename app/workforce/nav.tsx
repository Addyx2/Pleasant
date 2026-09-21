"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, UserRound, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/workforce", label: "My shifts", icon: CalendarDays },
  { href: "/workforce/open-shifts", label: "Open shifts", icon: Zap },
  { href: "/workforce/timesheets", label: "Timesheets", icon: ClipboardCheck },
  { href: "/workforce/profile", label: "Profile", icon: UserRound },
];

export function WorkforceNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-md items-stretch">
        {TABS.map((tab) => {
          const active = pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-3 text-[11px] font-medium transition",
                active ? "text-brand-700" : "text-slate-400 hover:text-slate-600",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition",
                  active ? "bg-brand-50" : "",
                )}
              >
                <tab.icon className="h-5 w-5" />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}