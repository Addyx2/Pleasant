"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  Inbox,
  LayoutDashboard,
  Receipt,
  Users,
  UserSquare2,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/shifts", label: "Shifts", icon: CalendarClock },
  { href: "/shifts/requests", label: "Shift requests", icon: Inbox },
  { href: "/timesheets", label: "Timesheets", icon: ClipboardCheck },
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/clients", label: "Clients", icon: UserSquare2 },
  { href: "/billing", label: "Billing", icon: Receipt },
  { href: "/payroll", label: "Payroll", icon: FileText },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition duration-150",
              active
                ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/10"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <span
              className={cn(
                "absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-full bg-brand-500 transition-opacity duration-150",
                active ? "opacity-100" : "opacity-0",
              )}
              aria-hidden="true"
            />
            <item.icon
              className={cn(
                "h-4 w-4 transition-colors duration-150",
                active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}