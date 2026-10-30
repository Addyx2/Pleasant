"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MessageSquareText, Send } from "lucide-react";

import { cn } from "@/lib/utils";

const TABS = [
  { href: "/persona/pushbots", label: "Filling shifts", icon: Send, match: (p: string) => p === "/persona/pushbots" },
  { href: "/persona/pushbots/messages", label: "Texts", icon: MessageSquareText, match: (p: string) => p.startsWith("/persona/pushbots/messages") },
];

export function PushbotsTabs() {
  const pathname = usePathname();
  return (
    <nav aria-label="Pushbots" className="flex gap-1 rounded-lg bg-slate-100 p-1">
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
