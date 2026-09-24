import { LogOut } from "lucide-react";

import { AppNav } from "@/components/AppNav";
import { logoutAction } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="product-canvas min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-6 lg:flex">
        <div className="flex items-center gap-3 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-base font-bold text-white shadow-btn">
            P
          </span>
          <div className="leading-tight">
            <p className="font-display text-[15px] font-bold tracking-tight text-slate-900">
              Pleasant
            </p>
            <p className="truncate text-xs text-slate-500">{user.agency.name}</p>
          </div>
        </div>

        <div className="mt-8 flex-1">
          <AppNav />
        </div>

        <div className="space-y-2 border-t border-slate-200 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-semibold text-brand-700 ring-1 ring-inset ring-brand-600/10">
              {initials(user.firstName, user.lastName)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-slate-900">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.role.toLowerCase()}</p>
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
              P
            </span>
            <div className="leading-tight">
              <p className="font-display text-sm font-bold tracking-tight text-slate-900">
                Pleasant
              </p>
              <p className="truncate text-xs text-slate-500">{user.agency.name}</p>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl px-5 py-8 lg:px-10">{children}</main>
      </div>
    </div>
  );
}