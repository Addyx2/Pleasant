import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { WorkersPwaTags } from "@/components/WorkersPwaTags";
import { WorkforceNav } from "./nav";

export const metadata: Metadata = {
  title: { default: "Pleasant Workers", template: "%s · Pleasant Workers" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pleasant Workers" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#237670",
};

export default async function WorkforceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "STAFF") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <WorkersPwaTags />

      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-base font-bold text-white">
              P
            </span>
            <div className="leading-tight">
              <p className="font-display text-[15px] font-bold tracking-tight text-slate-900">
                Pleasant Workers
              </p>
              <p className="text-[11px] text-slate-500">
                Hi {user.firstName.split(" ")[0]} · {user.staff?.jobTitle}
              </p>
            </div>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
            {user.firstName[0]}
            {user.lastName?.[0] ?? ""}
          </span>
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">{children}</main>

      <WorkforceNav />
    </div>
  );
}