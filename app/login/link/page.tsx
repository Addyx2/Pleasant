import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AULTRUM_LINK_COOKIE, openCookie } from "@/lib/aultrum-id";

import type { PendingLink } from "./actions";
import { LinkForm } from "./LinkForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Link your Aultrum ID" };

export default async function LinkPage() {
  const pending = openCookie<PendingLink>("aid-link", (await cookies()).get(AULTRUM_LINK_COOKIE)?.value);
  if (!pending) redirect("/login?aultrum=expired");
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">P</span>
        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Link your Aultrum ID</h1>
        <p className="mt-1 text-sm text-slate-600">
          You&apos;re signed in to Aultrum ID as <strong className="font-medium text-slate-900">{pending.email}</strong>. Confirm
          your Pleasant password once to link the two. After that, Aultrum ID signs you straight in.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LinkForm email={pending.email} />
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/reset" className="font-medium text-brand-700 hover:text-brand-800">Forgot your Pleasant password?</Link>
        </p>
      </div>
    </main>
  );
}
