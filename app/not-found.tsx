import Link from "next/link";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <div className="max-w-sm text-center">
        <p className="font-display text-sm font-semibold text-brand-600">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-slate-900">
          We couldn&apos;t find that page
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The link may be out of date, or the record may belong to another agency.
        </p>
        <div className="mt-6 flex justify-center gap-4 text-sm font-medium">
          <Link href="/oversight" className="text-brand-700 hover:text-brand-800">
            Go to Oversight →
          </Link>
          <Link href="/" className="text-slate-500 hover:text-slate-700">
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
