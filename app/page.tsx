import Link from "next/link";
import {
  ArrowRight,
  CalendarClock,
  Check,
  ClipboardCheck,
  PoundSterling,
  Users,
} from "lucide-react";

import { cn } from "@/lib/utils";

const NAV_ITEMS = ["Dashboard", "Shifts", "Shift requests", "Timesheets", "Staff", "Clients", "Payroll"];

const SHIFT_ROWS = [
  { title: "Morning care — Margaret R.", time: "08:00 – 11:00", carer: "Ola A.", open: false },
  { title: "Evening care — James B.", time: "19:00 – 21:00", carer: null, open: true },
  { title: "Overnight — Ivy Court", time: "22:00 – 06:00", carer: "Tunde A.", open: false },
  { title: "Day care — Sun House", time: "09:00 – 17:00", carer: "Mariam K.", open: false },
];

const ROTA_ROWS = [
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

const PROVIDERS = [
  { name: "Ivy Court", today: "4 visits" },
  { name: "Sun House", today: "6 visits" },
];

const EDITORIAL = [
  {
    num: "01",
    eyebrow: "SHIFTS",
    icon: CalendarClock,
    heading: "Rotas that plan themselves",
    body: "Build a rota in minutes, match open slots to the right carers, and see gaps at a glance — before they become expensive agency calls.",
  },
  {
    num: "02",
    eyebrow: "TIMESHEETS",
    icon: ClipboardCheck,
    heading: "Approvals with a trail",
    body: "Carers clock in and out against real shifts. Managers approve or dispute hours, with every step recorded for the audit.",
  },
  {
    num: "03",
    eyebrow: "PAYROLL",
    icon: PoundSterling,
    heading: "UK payroll, done right",
    body: "PAYE, National Insurance, pensions and holiday pay calculated to current HMRC thresholds — for every run, to the penny.",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "We stopped matching shifts on WhatsApp. Pleasant keeps the whole rota on one screen.",
    name: "Office manager",
    role: "Domiciliary care agency",
  },
  {
    quote:
      "Approving timesheets used to eat my Friday. Now it's a ten-minute click-through with a full trail.",
    name: "Operations lead",
    role: "Home care provider",
  },
  {
    quote:
      "The payroll engine pays my carers to the penny under UK rules — no more guessing NI and pensions.",
    name: "Registered manager",
    role: "Care agency",
  },
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
          pleasant.aultrum.co.uk/dashboard
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
                14 open shifts
              </span>
              <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[10px] font-medium text-slate-600">
                Pay Fri
              </span>
              <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-800">
                3 to approve
              </span>
            </div>
          </div>

          <div className="mt-4 overflow-hidden rounded-lg border border-slate-200">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60">
                  {["Shift", "Time", "Carer", "Status"].map((h) => (
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
                {SHIFT_ROWS.map((row) => (
                  <tr key={row.title}>
                    <td className="px-3 py-2 text-[11px] font-medium text-slate-900">{row.title}</td>
                    <td className="tabular px-3 py-2 text-[11px] text-slate-500">{row.time}</td>
                    <td className="px-3 py-2">
                      {row.carer ? (
                        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-semibold text-brand-700">
                          {row.carer}
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          row.open ? "bg-amber-50 text-amber-800" : "bg-brand-50 text-brand-700",
                        )}
                      >
                        {row.open ? "OPEN" : "SCHEDULED"}
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
            Built for UK healthcare agencies
          </span>
          <h1 className="font-display mt-6 text-5xl font-bold leading-[1.02] tracking-tight text-slate-900 sm:text-6xl lg:text-7xl">
            Shifts, timesheets, payroll —
            <br className="hidden sm:block" /> from one calm place.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-600">
            Pleasant schedules carers, captures their approved hours, and pays them correctly
            under UK PAYE, National Insurance and pension rules. No spreadsheets, no
            back-office scramble.
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
              One calm place for the whole back office.
            </h2>
            <p className="mt-4 text-base leading-relaxed text-slate-600">
              Everything an agency admin does in a day, on one screen — no tabs, no exports,
              no duplicated effort.
            </p>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {/* Rota */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-3">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <CalendarClock className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Rota
                  </p>
                  <p className="text-sm font-semibold text-slate-900">Build rotas in minutes</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {ROTA_ROWS.map((r) => (
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

            {/* Payroll */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-1">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <PoundSterling className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Payroll
                  </p>
                  <p className="text-sm font-semibold text-slate-900">PAYE, NI & pensions</p>
                </div>
              </div>
              <div className="mt-5 space-y-2.5 rounded-lg border border-slate-200 p-3">
                {[
                  ["Gross", "£2,840.00"],
                  ["Income Tax", "£342.66"],
                  ["Employee NI", "£182.40"],
                  ["Net pay", "£2,314.94"],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[11px] text-slate-500">{k}</span>
                    <span className="tabular text-[11px] font-semibold text-slate-900">{v}</span>
                  </div>
                ))}
                <div className="border-t border-slate-100 pt-2">
                  <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                    Run 47 · PAID
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

            {/* Clients & staff */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-150 hover:border-slate-300 lg:col-span-2">
              <div className="flex items-center gap-3">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600 ring-1 ring-inset ring-black/[0.04]">
                  <Users className="h-4.5 w-4.5" />
                </span>
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    Clients & staff
                  </p>
                  <p className="text-sm font-semibold text-slate-900">One record, always current</p>
                </div>
              </div>
              <div className="mt-5 space-y-2">
                {PROVIDERS.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <span className="text-[11px] font-medium text-slate-900">{p.name}</span>
                    <span className="text-[11px] text-slate-500">
                      {p.today} <span className="text-slate-300">·</span>{" "}
                      <span className="text-slate-400">today</span>
                    </span>
                  </div>
                ))}
                <div className="rounded-lg border border-slate-200 px-3 py-2">
                  <span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-[10px] font-semibold text-brand-700">
                    Night premium +35%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-slate-200 bg-slate-50/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <div className="grid gap-5 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure key={t.name} className="rounded-xl border border-slate-200 bg-white p-6">
                <blockquote className="text-sm leading-relaxed text-slate-700">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
                    {t.name[0]}
                  </span>
                  <div className="leading-tight">
                    <p className="text-sm font-medium text-slate-900">{t.name}</p>
                    <p className="text-xs text-slate-500">{t.role}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-slate-200">
        <div className="mx-auto max-w-3xl px-6 py-24 text-center">
          <h2 className="font-display text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">
            Calm back office, happy carers.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-slate-600">
            Step into the demo with a prefilled login and feel what one screen for the whole
            agency is like.
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
            Payroll figures are estimates based on published HMRC thresholds and must be
            validated before submission. Pleasant is part of the Aultrum family.
          </p>
        </div>
      </footer>
    </main>
  );
}