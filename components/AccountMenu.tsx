"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsUpDown, LogOut, MonitorSmartphone } from "lucide-react";

import { logoutAction, logoutEverywhereAction } from "@/app/login/actions";
import { navForRole } from "@/lib/navigation";
import { ROLE_LABELS, type AppRole } from "@/lib/permissions";
import { cn, initials } from "@/lib/utils";

import { useSidebar } from "./SidebarShell";

interface AccountMenuProps {
  user: { firstName: string; lastName: string; email: string; role: string; agencyName: string };
  /** In the desktop sidebar the button follows the icon rail; in the mobile drawer it is always full. */
  allowRail?: boolean;
}

const itemClass =
  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-900";

/** The account name opens a menu with the agency's workspace pages and sign-out. */
export function AccountMenu({ user, allowRail = false }: AccountMenuProps) {
  const pathname = usePathname();
  const { rail } = useSidebar();
  const compact = allowRail && rail;
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { workspace } = navForRole(user.role);
  const inWorkspace = workspace.some((i) => pathname === i.href || pathname.startsWith(`${i.href}/`));
  const name = `${user.firstName} ${user.lastName}`;
  const role = ROLE_LABELS[user.role as AppRole] ?? user.role;

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="account-menu"
        aria-label={`Account menu for ${name}`}
        title={compact ? name : undefined}
        className={cn(
          "flex w-full items-center gap-3 rounded-lg text-left transition hover:bg-slate-100",
          compact ? "justify-center p-1" : "px-2 py-1.5",
          (open || inWorkspace) && "bg-slate-100",
        )}
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
          {initials(user.firstName, user.lastName)}
        </span>
        {compact ? null : (
          <>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate text-sm font-medium text-slate-900">{name}</span>
              <span className="block truncate text-xs text-slate-500">{role}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
          </>
        )}
      </button>

      {open ? (
        <div
          id="account-menu"
          className={cn(
            "absolute z-50 w-64 rounded-xl border border-slate-200 bg-white p-1.5 shadow-pop",
            compact ? "bottom-0 left-full ml-3" : "bottom-full left-0 mb-2",
          )}
        >
          <div className="px-2.5 pb-2 pt-1.5 leading-tight">
            <p className="truncate text-sm font-semibold text-slate-900">{name}</p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
            <p className="mt-1 truncate text-xs text-slate-400">
              {role} · {user.agencyName}
            </p>
          </div>

          {workspace.length > 0 ? (
            <div className="border-t border-slate-100 pt-1.5">
              <p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Workspace</p>
              {workspace.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(itemClass, active && "bg-brand-50 text-brand-900")}
                  >
                    {Icon ? <Icon className={cn("h-4 w-4", active ? "text-brand-600" : "text-slate-400")} /> : null}
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ) : null}

          <div className="mt-1.5 border-t border-slate-100 pt-1.5">
            <form action={logoutAction}>
              <button type="submit" className={itemClass}>
                <LogOut className="h-4 w-4 text-slate-400" />
                Sign out
              </button>
            </form>
            <form action={logoutEverywhereAction}>
              <button type="submit" className={itemClass}>
                <MonitorSmartphone className="h-4 w-4 text-slate-400" />
                Sign out of all devices
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
