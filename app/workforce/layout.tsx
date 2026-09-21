import type { Metadata, Viewport } from "next";
import { redirect } from "next/navigation";

import { requireUser } from "@/lib/auth";
import { WorkforceNav } from "./nav";

export const metadata: Metadata = {
  title: { default: "Workforce · Pleasant", template: "%s · Pleasant" },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Pleasant" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#4f46e5",
};

export default async function WorkforceLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  if (user.role !== "STAFF") redirect("/dashboard");

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
      <header className="sticky top-0 z-20 border-b border-slate-100 bg-white/90 px-5 pb-3 pt-5 backdrop-blur">
        <div className="flex items-center justify-between">
          <div className="leading-tight">
            <p className="text-lg font-bold tracking-tight text-slate-900">
              Hi {user.firstName.split(" ")[0]} 👋
            </p>
            <p className="text-xs text-slate-500">{user.staff?.jobTitle}</p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
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