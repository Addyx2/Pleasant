import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  PoundSterling,
  ShieldCheck,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = ["Placements", "Open shifts", "Candidates", "Timesheets", "Billing", "Payroll"];

const REQUEST_ROWS = [
  { client: "St Andrew's Care Home · Sister cover", time: "18:00 – 22:00", match: "Ola A.", margin: "£23", confirmed: true },
  { client: "Maple Court · Night cover", time: "22:00 – 06:00", match: null, margin: "Unquoted", confirmed: false },
  { client: "Springvale · Day shift", time: "09:00 – 17:00", match: "Tunde A.", margin: "£18", confirmed: true },
  { client: "Hillcrest · Weekend", time: "Sat 08:00 – 14:00", match: "Mariam K.", margin: "£21", confirmed: true },
];

const PLACEMENT_ROWS = [
  { day: "Mon", morning: "Ola A.", evening: "Tunde A." },
  { day: "Tue", morning: "Open", evening: "Mariam K." },
  { day: "Wed", morning: "Mariam K.", evening: "Open" },
  { day: "Thu", morning: "Ola A.", evening: "Tunde A." },
];

const APPROVALS = [
  { name: "Ola A.", hours: "7h 30m" },
  { name: "Tunde A.", hours: "8h 00m" },
  { name: "Mariam K.", hours: "6h 45m" },
];

const CANDIDATES = [
  { name: "Ola A.", status: "DBS ✓ · Training ✓" },
  { name: "Tunde A.", status: "DBS ✓ · Right to work ✓" },
  { name: "Mariam K.", status: "DBS ✓ · Training ✓" },
];

const EDITORIAL = [
  {
    num: "01",
    eyebrow: "MATCH",
    icon: CalendarClock,
    heading: "Cover without 15 phone calls",
    body: "A client sends a shift request; Pleasant surfaces the best-available worker from your team and the open-shift marketplace, and you confirm the match in a tap.",
  },
  {
    num: "02",
    eyebrow: "TIMESHEETS",
    icon: ClipboardCheck,
    heading: "Hours confirmed with a trail",
    body: "Workers clock in and out against real placements. Bookers and client sites sign off every shift before anything is billed.",
  },
  {
    num: "03",
    eyebrow: "PAYROLL",
    icon: PoundSterling,
    heading: "Pay and bill from one engine",
    body: "UK PAYE, NI and pensions calculated for workers while the client bill is built from the same approved hours — with submission to HMRC (RTI) piloted alongside early agencies.",
  },
];

const TRUST = [
  { icon: ShieldCheck, title: "GDPR-aligned", body: "Worker and client data handled under UK GDPR rules, isolated per agency." },
  { icon: ShieldCheck, title: "Encrypted by default", body: "TLS in transit and encryption at rest on managed EU infrastructure." },
  { icon: ShieldCheck, title: "Full audit trail", body: "Every placement, approval and payroll event is recorded and traceable." },
  { icon: ShieldCheck, title: "Compliance hooks", body: "DBS, right-to-work and training flags on every worker record and shift." },
];

function ProductWindow() {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white text-left shadow-card">
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50/80 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-red-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber-400/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-400/80" />
        </span>
        <span className="mx-auto rounded-md border border-slate-200 bg-white px-4 py-1 text-[11px] text-slate-500">
          pleasant.aultrum.co.uk/placements
        </span>
        <span className="w-12" aria-hidden="true" />
      </div>

      <div className="grid grid-cols-[190px_1fr]">
        <aside className="hidden border-r border-slate-200 bg-slate-50/40 px-3 py-4 sm:block">
          <div className="flex items-center gap-2 px-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-b from-brand-500 to-brand-700 text-[11px] font-bold text-white">
              P
            </span>
            <span className="font-display text-[12px] font-bold tracking-tight text-slate-900">
              Pleasant
            </span>
          </div>
          <nav className="mt-4 space-y-1">
            {NAV_ITEMS.map((label, i) => (
              <div
                key={label}
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] font-medium",
                  i === 0 ? "bg-brand-50 text-brand-700" : "text-slate-500",
                )}
              >
                <span
                  className={cn("h-1 w-1 rounded-full", i === 0 ? "bg-brand-500" : "bg-slate-300")}
                  aria-hidden="true"
                />
                {label}
              </div>
            ))}
          </nav>
        </aside>

        <div className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                Wednesday · 24 Sep
              </p>
              <p className="font-display mt-0.5 text-[15px] font-bold tracking-tight text-slate-900">
                Good to see you, Noor.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                7 open requests
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                £1,204 margin today
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                3 to bill
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  {["Client request", "Time", "Match", "Margin"].map((h) => (
                    <th
                      key={h}
                      className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {REQUEST_ROWS.map((row) => (
                  <tr key={row.client}>
                    <td className="px-3 py-2 text-[11px] font-medium text-slate-900">{row.client}</td>
                    <td className="tabular px-3 py-2 text-[11px] text-slate-500">{row.time}</td>
                    <td className="px-3 py-2">
                      {row.match ? (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                          {row.match}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Open
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          row.confirmed ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                        )}
                      >
                        {row.margin}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="border-b border-slate-200">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-b from-brand-500 to-brand-700 text-base font-bold text-white shadow-btn">
              P
            </span>
            <span className="font-display text-lg font-bold tracking-tight">Pleasant</span>
          </div>
          <nav className="flex items-center gap-3">
            <Link
              href="/pricing"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Pricing
            </Link>
            <Link
              href="/login"
              className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-900"
            >
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-btn hover:bg-brand-700"
            >
              Open the app
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-20 pt-20 sm:pt-24">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            Built for UK healthcare staffing agencies
          </span>
          <h1 className="font-display mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Fill every shift request.
            <br className="hidden sm:block" />{" "}
            <span className="text-brand-600">Keep every margin.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Pleasant matches workers to requests, captures the hours, pays under UK PAYE and bills
            the client — one loop from shift to invoice, with the margin visible on every
            placement.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-btn transition duration-150 hover:bg-brand-700 active:scale-[0.99]"
            >
              Enter the demo agency <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition duration-150 hover:bg-slate-50 active:scale-[0.99]"
            >
              See pricing
            </Link>
          </div>
          <p className="mt-4 text-xs text-slate-500">
            Demo login is prefilled on the sign-in screen.
          </p>
        </div>

        <div className="mx-auto mt-16 max-w-4xl">
          <ProductWindow />
        </div>
      </section>

      {/* Editorial numbered sections */}
      <section className="border-t border-slate-200 bg-slate-50/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-12 lg:grid-cols-3">
            {EDITORIAL.map((f) => (
              <div key={f.num} className="border-t border-slate-300 pt-6">
                <div className="flex items-center gap-3">
                  <span className="tabular font-display text-2xl font-bold text-brand-600/60">
                    {f.num}
                  </span>
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                    {f.eyebrow}
                  </span>
                </div>
                <div className="mt-5 flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <f.icon className="h-5 w-5" />
                </div>
                <h2 className="font-display mt-4 text-xl font-bold tracking-tight text-slate-900">
                  {f.heading}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{f.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Product bento */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
              The back office, tuned to placements.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Request to match, match to approved hours, hours to pay and bill. One screen, one
              source of truth, margin at every step.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {/* Placements */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <CalendarClock className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Placements
                  </p>
                  <p className="text-sm font-semibold text-slate-900">Requests, matched fast</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {PLACEMENT_ROWS.map((r) => (
                  <div
                    key={r.day}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="w-8 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {r.day}
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">
                        {r.morning}
                      </span>
                      <span className="text-[11px] text-slate-300">·</span>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          r.evening === "Open"
                            ? "bg-amber-50 text-amber-800"
                            : "bg-brand-50 text-brand-700",
                        )}
                      >
                        {r.evening}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Margin */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-1">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <PoundSterling className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Margin
                  </p>
                  <p className="text-sm font-semibold text-slate-900">Visible per placement</p>
                </div>
              </div>
              <div className="mt-5 space-y-2.5 rounded-lg border border-slate-200 p-3">
                {[
                  ["Client bill", "£4,120.00"],
                  ["Worker pay", "£2,480.00"],
                  ["Gross margin", "£1,640.00"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{k}</span>
                    <span className="tabular text-[11px] font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    40% margin · This week
                  </span>
                </div>
              </div>
            </div>

            {/* Timesheets */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <ClipboardCheck className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Timesheets
                  </p>
                  <p className="text-sm font-semibold text-slate-900">Honest hours, approved fast</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {APPROVALS.map((a) => (
                  <div
                    key={a.name}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-[10px] font-bold text-brand-700">
                        {a.name[0]}
                      </span>
                      <span className="text-[11px] font-medium text-slate-900">{a.name}</span>
                      <span className="tabular text-[11px] text-slate-400">{a.hours}</span>
                    </div>
                    <span className="inline-flex items-center gap-1 rounded-md bg-brand-600 px-2.5 py-1 text-[10px] font-semibold text-white">
                      <Check className="h-3 w-3" /> Approve
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Candidates & compliance */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <Users className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Candidates
                  </p>
                  <p className="text-sm font-semibold text-slate-900">Miss nothing on a change of shift</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {CANDIDATES.map((c) => (
                  <div
                    key={c.name}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="text-[11px] font-medium text-slate-900">{c.name}</span>
                    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                      {c.status}
                    </span>
                  </div>
                ))}
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                    Night premium +35%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Pilot programme */}
      <section className="border-t border-slate-200 bg-slate-50/40">
        <div className="mx-auto max-w-3xl px-6 py-20 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-500" aria-hidden="true" />
            Pilot programme · Winter 2026
          </span>
          <h2 className="font-display mt-6 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Launching with a first cohort of staffing agencies.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            We&apos;re onboarding our first three agencies at founder pricing. Their numbers —
            requests covered, hours approved, payroll runs closed — get published here as they
            land. Until then, judge the product on the demo.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a
              href="mailto:Wisdom@aultrum.co.uk"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-btn transition duration-150 hover:bg-brand-700 active:scale-[0.99]"
            >
              Join the pilot <ArrowRight className="h-4 w-4" />
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition duration-150 hover:bg-slate-50 active:scale-[0.99]"
            >
              Try the demo
            </Link>
          </div>
        </div>
      </section>

      {/* Security & data */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
            Built on trust.
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-slate-600">
            Worker data, client data and wage data deserve the same care in software as they get
            at an inspection.
          </p>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {TRUST.map((t) => (
              <div
                key={t.title}
                className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300"
              >
                <t.icon className="h-5 w-5 text-brand-600" />
                <h3 className="mt-4 text-sm font-semibold text-slate-900">{t.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600">{t.body}</p>
              </div>
            ))}
          </div>
          <p className="mt-8 text-xs text-slate-500">
            Cyber Essentials assessment is scheduled alongside our rollout, and we work with pilot
            agencies on their HMRC RTI submissions as the payroll loop closes end to end.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Run placements from request to payment.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Step into the demo with a prefilled login and feel the whole loop — match, approve,
            pay, bill, margin — on one screen.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-btn transition duration-150 hover:bg-brand-700 active:scale-[0.99]"
            >
              Enter the demo agency <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-medium text-slate-700 transition duration-150 hover:bg-slate-50 active:scale-[0.99]"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200">
        <div className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 text-xs font-bold text-white">
                P
              </span>
              <span className="font-display text-sm font-bold tracking-tight">Pleasant</span>
            </div>
            <nav className="flex items-center gap-4 text-sm text-slate-600">
              <Link href="/pricing" className="hover:text-slate-900">
                Pricing
              </Link>
              <Link href="/login" className="hover:text-slate-900">
                Sign in
              </Link>
            </nav>
          </div>
          <p className="mt-6 max-w-3xl text-xs text-slate-500">
            Payslips and payroll figures are calculated to current HMRC thresholds. Submission to
            HMRC (RTI) is being piloted with early agencies, and final liability remains with the
            agency that files. Pleasant is part of the Aultrum family.
          </p>
        </div>
      </footer>
    </main>
  );
}