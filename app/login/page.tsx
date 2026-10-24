import Link from "next/link";

import { DEMO_MODE } from "@/lib/constants";

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
          {DEMO_MODE
            ? "Use the demo credentials below to explore Pleasant."
            : "Welcome back. Sign in with your work email."}
        </p>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <LoginForm next={next} demo={DEMO_MODE} />
        </div>

        {DEMO_MODE ? (
          <p className="mt-4 text-center text-xs text-slate-500">
            Demo: admin@pleasant.demo · pleasant123
          </p>
        ) : null}
        <div className="mt-2 flex items-center justify-center gap-4 text-sm">
          <Link href="/reset" className="font-medium text-brand-700 hover:text-brand-800">
            Forgot password?
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/signup" className="font-medium text-brand-700 hover:text-brand-800">
            New agency? Create your account →
          </Link>
        </div>
        <p className="mt-6 text-center text-xs text-slate-500">
          New to Pleasant?{" "}
          <a href="https://aultrum.co.uk/pleasant/" className="font-medium text-slate-700 hover:text-slate-900">
            See what it does
          </a>{" "}
          or{" "}
          <a href="https://aultrum.co.uk/pleasant/book-a-demo/" className="font-medium text-slate-700 hover:text-slate-900">
            book a demo
          </a>
          .
        </p>
      </div>
    </main>
  );
}
