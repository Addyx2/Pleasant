import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";

import { AppNav } from "@/components/AppNav";
import { AssistPanel } from "@/components/assist/AssistPanel";
import { CommandPalette, CommandPaletteTrigger } from "@/components/CommandPalette";
import { MobileHeader } from "@/components/MobileHeader";
import { SidebarShell, SidebarToggle } from "@/components/SidebarShell";
import { logoutAction, logoutEverywhereAction } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { CLOSED_COOKIE, RAIL_COOKIE } from "@/lib/sidebar";
import { ROLE_LABELS, isOpsRole, type AppRole } from "@/lib/permissions";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Carers live in the Workers app; the back office is for admins and managers.
  if (!isOpsRole(user.role)) redirect("/workforce");
  const jar = await cookies();
  const rail = jar.get(RAIL_COOKIE)?.value === "1";
  const closed = (jar.get(CLOSED_COOKIE)?.value ?? "").split(",").filter(Boolean);

  return (
    <SidebarShell initialRail={rail} initialClosed={closed}>
      <div className="product-canvas min-h-screen pb-16">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-lg focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:shadow-pop"
        >
          Skip to content
        </a>
        <CommandPalette role={user.role} />
        <AssistPanel role={user.role} firstName={user.firstName} />

        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex group-data-[sidebar=rail]/shell:w-16">
          <div className="flex items-center gap-3 pl-6 pr-3 pt-6 group-data-[sidebar=rail]/shell:flex-col group-data-[sidebar=rail]/shell:gap-2 group-data-[sidebar=rail]/shell:px-0">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-base font-bold text-white shadow-btn">
              P
            </span>
            <div className="min-w-0 flex-1 leading-tight group-data-[sidebar=rail]/shell:hidden">
              <p className="font-display text-[15px] font-bold tracking-tight text-slate-900">Pleasant</p>
              <p className="truncate text-xs text-slate-500">{user.agency.name}</p>
            </div>
            <SidebarToggle />
          </div>

          <div className="px-4 pt-5 group-data-[sidebar=rail]/shell:px-3">
            <CommandPaletteTrigger followRail />
          </div>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto px-4 pb-4 group-data-[sidebar=rail]/shell:px-2">
            <AppNav role={user.role} allowRail />
          </div>

          <div className="space-y-1 border-t border-slate-200 px-4 py-4 group-data-[sidebar=rail]/shell:px-2">
            <div className="flex items-center gap-3 px-2 pb-1 group-data-[sidebar=rail]/shell:justify-center group-data-[sidebar=rail]/shell:px-0" title={`${user.firstName} ${user.lastName}`}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
                {initials(user.firstName, user.lastName)}
              </span>
              <div className="min-w-0 flex-1 leading-tight group-data-[sidebar=rail]/shell:hidden">
                <p className="truncate text-sm font-medium text-slate-900">
                  {user.firstName} {user.lastName}
                </p>
                <p className="truncate text-xs text-slate-500">{ROLE_LABELS[user.role as AppRole]}</p>
              </div>
            </div>
            <form action={logoutAction}>
              <button
                type="submit"
                aria-label="Sign out"
                title="Sign out"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 group-data-[sidebar=rail]/shell:justify-center group-data-[sidebar=rail]/shell:px-0"
              >
                <LogOut className="h-4 w-4" />
                <span className="group-data-[sidebar=rail]/shell:hidden">Sign out</span>
              </button>
            </form>
            <form action={logoutEverywhereAction} className="group-data-[sidebar=rail]/shell:hidden">
              <button
                type="submit"
                className="w-full rounded-lg px-3 py-1 text-left text-xs text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              >
                Sign out of all devices
              </button>
            </form>
          </div>
        </aside>

        <div className="lg:pl-64 lg:group-data-[sidebar=rail]/shell:pl-16">
          <MobileHeader user={user} />
          <main id="main" className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </SidebarShell>
  );
}
