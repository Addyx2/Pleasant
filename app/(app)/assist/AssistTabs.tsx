"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessagesSquare, PlugZap, Repeat } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/assist", label: "Chats", icon: MessagesSquare, match: (p: string) => p === "/assist" || p.startsWith("/assist/c/") },
  { href: "/assist/automations", label: "Automations", icon: Repeat, match: (p: string) => p.startsWith("/assist/automations") },
  { href: "/assist/connections", label: "Connections", icon: PlugZap, match: (p: string) => p.startsWith("/assist/connections") },
];

export function AssistTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Assist" className="flex gap-1 rounded-lg bg-slate-100 p-1">
      {TABS.map((tab) => {
        const active = tab.match(pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition",
              active ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800",
            )}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
