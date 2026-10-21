import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { AppNav } from "@/components/AppNav";
import { CommandPalette, CommandPaletteTrigger } from "@/components/CommandPalette";
import { MobileHeader } from "@/components/MobileHeader";
import { logoutAction, logoutEverywhereAction } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS, isOpsRole, type AppRole } from "@/lib/permissions";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Carers live in the Workers app; the back office is for admins and managers.
  if (!isOpsRole(user.role)) redirect("/workforce");

  return (
    <div className="product-canvas min-h-screen pb-16">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
      >
        Skip to content
      </a>
      <CommandPalette role={user.role} />

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex items-center gap-3 px-6 pt-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-base font-bold text-white shadow-btn">
            P
          </span>
          <div className="min-w-0 leading-tight">
            <p className="font-display text-[15px] font-bold tracking-tight text-slate-900">Pleasant</p>
            <p className="truncate text-xs text-slate-500">{user.agency.name}</p>
          </div>
        </div>

        <div className="px-4 pt-5">
          <CommandPaletteTrigger />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 pb-4">
          <AppNav role={user.role} />
        </div>

        <div className="space-y-1 border-t border-slate-200 px-4 py-4">
          <div className="flex items-center gap-3 px-2 pb-1">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
              {initials(user.firstName, user.lastName)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role as AppRole]}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
          <form action={logoutEverywhereAction}>
            <button
              type="submit"
              className="w-full rounded-lg px-3 py-1 text-left text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
            >
              Sign out of all devices
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        <MobileHeader user={user} />
        <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
