"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Smartphone,
  Users,
  UserSquare2,
} from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/my-shifts", label: "My shifts", icon: Smartphone },
  { href: "/shifts", label: "Shifts", icon: CalendarClock },
  { href: "/timesheets", label: "Timesheets", icon: ClipboardCheck },
  { href: "/staff", label: "Staff", icon: Users },
  { href: "/clients", label: "Clients", icon: UserSquare2 },
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
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
              active
                ? "bg-brand-600 text-white"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
            )}
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
