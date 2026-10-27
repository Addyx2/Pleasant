import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { installationFor } from "@/lib/elements";
import { WorkersPwaTags } from "@/components/WorkersPwaTags";
import { WorkforceNav } from "./nav";
import { AppMark } from "@/components/Brand";

export const metadata: Metadata = {
  title: { default: "Aultrum Carer", template: "%s · Aultrum" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Aultrum" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#7c3aed",
};

export default async function WorkforceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "STAFF") redirect("/oversight");
  const peak = Boolean(await installationFor(user.agencyId, "PEAK"));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col bg-slate-50 font-sans">
      <WorkersPwaTags />

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/95 px-5 pb-3 pt-4 backdrop-blur shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <AppMark className="h-9 w-9" />
            <div className="leading-tight">
              <div className="flex items-center gap-1.5">
                <p className="font-display text-[15px] font-bold tracking-tight text-slate-900">
                  Aultrum
                </p>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-brand-50 text-brand-700">
                  Passport
                </span>
              </div>
              <p className="text-[11px] text-slate-500">
                {user.firstName} · {user.staff?.jobTitle ?? "Care Professional"}
              </p>
            </div>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 border border-slate-200">
            {user.firstName[0]}
            {user.lastName?.[0] ?? ""}
          </span>
        </div>
      </header>

      <main className="flex-1 px-5 pb-28 pt-5">{children}</main>

      <WorkforceNav peak={peak} />
    </div>
  );
}