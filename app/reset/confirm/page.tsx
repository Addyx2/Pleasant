import Link from "next/link";

import { ResetConfirmForm } from "./ResetConfirmForm";

export const metadata = { title: "Choose a new password" };

export default async function ResetConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight">Pleasant</span>
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Choose a new password</h1>
        <p className="mt-1 text-sm text-slate-600">
          Make it at least 8 characters. You will be asked to sign in again afterwards.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {token ? (
            <ResetConfirmForm token={token} />
          ) : (
            <p className="text-sm text-slate-600">
              This link is incomplete. Request a new one from the{" "}
              <Link href="/reset" className="font-medium text-brand-700 hover:underline">
                reset page
              </Link>
              .
            </p>
          )}
        </div>
      </div>
    </main>
  );
}