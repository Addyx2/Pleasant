import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AccountMenu } from "@/components/AccountMenu";
import { AppNav } from "@/components/AppNav";
import { AssistPanel } from "@/components/assist/AssistPanel";
import { CommandPalette, CommandPaletteTrigger } from "@/components/CommandPalette";
import { MobileHeader } from "@/components/MobileHeader";
import { SidebarShell, SidebarToggle } from "@/components/SidebarShell";
import { after } from "next/server";

import { requireUser } from "@/lib/auth";
import { maybeRunSignOffReminders } from "@/lib/sign-off-reminders";
import { CLOSED_COOKIE, RAIL_COOKIE } from "@/lib/sidebar";
import { isOpsRole } from "@/lib/permissions";
import { AppMark } from "@/components/Brand";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  // Sign-off reminders go out as the app is used (at most hourly).
  after(() => maybeRunSignOffReminders());
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
            <AppMark className="h-9 w-9" />
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

          <div className="border-t border-slate-200 px-3 py-3 group-data-[sidebar=rail]/shell:px-2">
            <AccountMenu
              allowRail
              user={{
                firstName: user.firstName,
                lastName: user.lastName,
                email: user.email,
                role: user.role,
                agencyName: user.agency.name,
              }}
            />
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
