import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  ClipboardCheck,
  FileText,
  PoundSterling,
  ShieldCheck,
  Users,
} from "lucide-react";

const FEATURES = [
  {
    icon: CalendarClock,
    title: "Shift scheduling",
    body: "Build rotas in minutes, assign the right carer, and track open shifts across every client and site.",
  },
  {
    icon: ClipboardCheck,
    title: "Timesheets & approvals",
    body: "Carers clock in and out against real shifts. Managers approve hours with a full audit trail.",
  },
  {
    icon: PoundSterling,
    title: "UK payroll engine",
    body: "PAYE, National Insurance, pensions and holiday accrual calculated to HMRC thresholds — per pay run.",
  },
  {
    icon: FileText,
    title: "Payslips & invoices",
    body: "Generate compliant payslips for every carer and see the true employer cost of each run.",
  },
  {
    icon: Users,
    title: "Staff records",
    body: "Pay rates, night and weekend premiums, NI numbers and tax codes in one place per carer.",
  },
  {
    icon: ShieldCheck,
    title: "Audit-ready",
    body: "Every shift, approval and payroll run is traceable, so inspections and HMRC queries are painless.",
  },
];

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight">Pleasant</span>
        </div>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Open the app
          </Link>
        </nav>
      </header>

      <section className="mt-20 max-w-3xl">
        <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
          Built for UK healthcare agencies
        </span>
        <h1 className="mt-6 text-5xl font-bold leading-tight tracking-tight text-slate-900">
          Shifts, timesheets and payroll — without the spreadsheets.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          Pleasant runs the whole back office of a care agency: schedule carers, capture
          approved hours, and pay them correctly under UK PAYE, National Insurance and
          pension rules. One platform, one source of truth.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Enter the demo agency <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-sm text-slate-500">
            Demo login is prefilled on the sign-in screen.
          </span>
        </div>
      </section>

      <section className="mt-20 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <feature.icon className="h-6 w-6 text-brand-600" />
            <h2 className="mt-4 text-base font-semibold text-slate-900">{feature.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">{feature.body}</p>
          </div>
        ))}
      </section>

      <footer className="mt-20 border-t border-slate-200 pt-6 text-sm text-slate-500">
        Payroll figures are estimates based on published HMRC thresholds and must be
        validated before submission. Pleasant is part of the Aultrum family.
      </footer>
    </main>
  );
}
