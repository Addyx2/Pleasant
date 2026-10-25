import Link from "next/link";

import { aultrumIdConfigured } from "@/lib/aultrum-id";
import { DEMO_MODE } from "@/lib/constants";

import { LoginForm } from "./LoginForm";

export const metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

const AULTRUM_ERRORS: Record<string, string> = {
  expired: "That Aultrum ID sign-in took too long. Try again.",
  cancelled: "Aultrum ID sign-in was cancelled.",
  failed: "Aultrum ID couldn't sign you in. Try again, or use your Pleasant password.",
  "no-account": "Your Aultrum ID email doesn't match a Pleasant account. Ask your agency admin to invite that email, or sign in with your password.",
  "no-access": "Your access to this agency has been removed. Contact your agency admin.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; aultrum?: string }>;
}) {
  const { next, aultrum } = await searchParams;
  const aultrumOn = aultrumIdConfigured();
  const aultrumError = aultrum ? AULTRUM_ERRORS[aultrum] : undefined;

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

        {aultrumError ? (
          <p role="alert" className="mt-6 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
            {aultrumError}
          </p>
        ) : null}

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          {aultrumOn ? (
            <>
              <a
                href={`/api/auth/aultrum/start${next ? `?next=${encodeURIComponent(next)}` : ""}`}
                className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M4 20 12 4l8 16" />
                  <path d="M8 13h8" />
                </svg>
                Sign in with Aultrum ID
              </a>
              <div className="my-5 flex items-center gap-3 text-xs text-slate-400">
                <span className="h-px flex-1 bg-slate-200" />
                or with your Pleasant password
                <span className="h-px flex-1 bg-slate-200" />
              </div>
            </>
          ) : null}
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
