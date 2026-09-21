import { LogOut } from "lucide-react";

import { AppNav } from "@/components/AppNav";
import { logoutAction } from "@/app/login/actions";
import { requireUser } from "@/lib/auth";
import { initials } from "@/lib/utils";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  return (
    <div className="min-h-screen">
      <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r border-slate-200 bg-white px-4 py-5 lg:flex">
        <div className="flex items-center gap-2 px-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            P
          </span>
          <div className="leading-tight">
            <p className="text-sm font-semibold tracking-tight">Pleasant</p>
            <p className="text-xs text-slate-500">{user.agency.name}</p>
          </div>
        </div>

        <div className="mt-6 flex-1">
          <AppNav />
        </div>

        <div className="border-t border-slate-200 pt-4">
          <div className="flex items-center gap-3 px-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {initials(user.firstName, user.lastName)}
            </span>
            <div className="min-w-0 flex-1 leading-tight">
              <p className="truncate text-sm font-medium text-slate-800">
                {user.firstName} {user.lastName}
              </p>
              <p className="truncate text-xs text-slate-500">{user.role.toLowerCase()}</p>
            </div>
          </div>
          <form action={logoutAction} className="mt-3">
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
        <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 lg:hidden">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold text-white">
            P
          </span>
          <span className="text-sm font-semibold">{user.agency.name}</span>
        </header>
        <main className="px-5 py-7 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
