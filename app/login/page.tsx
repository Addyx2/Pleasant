import Link from "next/link";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight">Pleasant</span>
        </Link>

        <h1 className="mt-8 text-2xl font-semibold tracking-tight">Sign in to your agency</h1>
        <p className="mt-1 text-sm text-slate-600">
          Use the demo credentials below to explore Pleasant.
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={next} />
        </div>

        <p className="mt-4 text-center text-xs text-slate-500">
          Demo: admin@pleasant.demo · pleasant123
        </p>
      </div>
    </main>
  );
}
