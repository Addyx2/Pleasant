"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, ShieldCheck, Sparkles, Zap } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/workforce", label: "Shifts", icon: CalendarDays },
  { href: "/workforce/open-shifts", label: "Pool", icon: Zap },
  { href: "/workforce/calendar", label: "Calendar", icon: CalendarRange },
  { href: "/workforce/peak", label: "Peak", icon: Sparkles },
  { href: "/workforce/passport", label: "Passport", icon: ShieldCheck },
];

export function WorkforceNav({ peak = false }: { peak?: boolean }) {
  const pathname = usePathname();
  // Peak only appears once the agency has switched it on.
  const tabs = peak ? TABS : TABS.filter((t) => t.href !== "/workforce/peak");

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/95 backdrop-blur-md">
      <div className="mx-auto flex w-full max-w-md items-stretch">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.href !== "/workforce" && pathname.startsWith(tab.href));
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition",
                active ? "text-slate-900 font-bold" : "text-slate-400 hover:text-slate-600",
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-10 items-center justify-center rounded-full transition",
                  active ? "bg-slate-900 text-white shadow-xs" : "text-slate-500",
                )}
              >
                <tab.icon className="h-4 w-4" />
              </span>
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}