"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Users,
  Clock,
  Banknote,
  UserPlus,
  Plus,
  CalendarClock,
  Building2,
  CheckCircle2,
  AlertTriangle,
  LayoutDashboard,
  Send,
  Repeat,
  ShieldCheck,
  FileUp,
  Settings,
} from "lucide-react";

import { cn } from "@/lib/utils";

const CATEGORIES = [
  {
    title: "WORKFORCE",
    items: [
      { href: "/staff", label: "Workers", icon: Users },
      { href: "/timesheets", label: "Timesheets", icon: Clock },
      { href: "/payroll", label: "Payroll", icon: Banknote },
      { href: "/workforce/recruitment", label: "Recruitment", icon: UserPlus },
    ],
  },
  {
    title: "SHIFTS & DISPATCH",
    items: [
      { href: "/shifts", label: "All Shifts", icon: CalendarClock },
      { href: "/rota", label: "Recurring Rota", icon: Repeat },
      { href: "/dispatch", label: "Dispatch", icon: Send },
      { href: "/shifts/unattended", label: "Unattended", icon: AlertTriangle },
    ],
  },
  {
    title: "COMPLIANCE",
    items: [
      { href: "/compliance", label: "Certificates", icon: ShieldCheck },
      { href: "/import", label: "Import Data", icon: FileUp },
    ],
  },
  {
    title: "CLIENTPOINT",
    items: [
      { href: "/clients", label: "Clients", icon: Building2 },
      { href: "/shifts/requests", label: "Shift Requests", icon: CheckCircle2 },
    ],
  },
{
    title: "ADDONS SUITE",
    items: [
      { href: "/addons", label: "Add-ons", icon: Plus },
      { href: "/settings", label: "Agency Settings", icon: Settings },
    ],
  },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-5 overflow-y-auto max-h-[calc(100vh-220px)] pr-1">
      <Link
        href="/oversight"
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition",
          pathname === "/oversight"
            ? "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-600/10 font-bold"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <LayoutDashboard className="h-4 w-4 text-brand-600" />
        Oversight
      </Link>

      {CATEGORIES.map((cat) => (
        <div key={cat.title} className="space-y-1">
          <p className="px-3 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
            {cat.title}
          </p>
          {cat.items.map((item) => {
            const active = pathname === item.href || (item.href !== "/shifts" && pathname.startsWith(`${item.href}`));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch={false}
                className={cn(
                  "group relative flex items-center gap-2.5 rounded-lg px-3 py-1.5 text-xs font-medium transition duration-150",
                  active
                    ? "bg-brand-50 text-brand-900 font-semibold ring-1 ring-inset ring-brand-600/10"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                )}
              >
                <span
                  className={cn(
                    "absolute left-0 top-1/2 h-3.5 w-0.5 -translate-y-1/2 rounded-full bg-brand-500 transition-opacity duration-150",
                    active ? "opacity-100" : "opacity-0"
                  )}
                  aria-hidden="true"
                />
                <item.icon
                  className={cn(
                    "h-3.5 w-3.5 transition-colors duration-150",
                    active ? "text-brand-600" : "text-slate-400 group-hover:text-slate-600"
                  )}
                />
                {item.label}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

