import Link from "next/link";

import { ResetRequestForm } from "./ResetRequestForm";

export const metadata = { title: "Reset password" };

export default function ResetPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight">Pleasant</span>
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Reset your password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Enter the email you use to sign in and we will send you a link.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <ResetRequestForm />
        </div>

        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="font-medium text-brand-700 hover:text-brand-800">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}