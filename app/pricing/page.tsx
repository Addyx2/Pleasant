import Link from "next/link";
import type { Metadata } from "next";
import {
  Bot,
  Calculator,
  ClipboardCheck,
  PhoneCall,
  Trophy,
  Users,
} from "lucide-react";

import PricingPlans from "@/components/PricingPlans";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Pricing for Pleasant — workforce management, payroll and billing for UK healthcare agencies, priced per active carer.",
};

const ADDONS = [
  {
    icon: Users,
    title: "Active-carer seats",
    body: "£4 per extra carer/mo on Lightforce, £3 on Midweight. Only carers who worked count.",
  },
  {
    icon: Bot,
    title: "Agent Runner",
    body: "From £149/mo per runner, metered runs. Covers shifts, negotiates via the marketplace, preps the payroll run.",
  },
  {
    icon: Trophy,
    title: "Peak",
    body: "Aultrum family rewards engine, from £49/mo. Points for clock-ins, praise and streaks, fed from Pleasant.",
  },
  {
    icon: PhoneCall,
    title: "Gateway",
    body: "Aultrum family AI contact centre add-on. Takes the call and books cover straight into your roster.",
  },
];

const STACK_EXISTING = [
  { tool: "Roster / scheduling", cost: "≈ £150/mo" },
  { tool: "Time & attendance + timesheets", cost: "≈ £100/mo" },
  { tool: "UK payroll run", cost: "≈ £200/mo" },
  { tool: "Client invoicing", cost: "≈ £100/mo" },
];

export default function PricingPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 pb-24 pt-16">
      <header className="flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-lg font-bold text-white">
            P
          </span>
          <span className="text-lg font-semibold tracking-tight">Pleasant</span>
        </Link>
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

      <section className="mx-auto mt-20 max-w-3xl text-center">
        <span className="inline-flex items-center rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-700">
          Pricing · UK healthcare agencies
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
          Simple pricing that scales with your agency.
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-slate-600">
          One platform replacing roster, timesheet, payroll and invoicing tools — priced per active
          carer, so you pay for carers who actually worked.
        </p>
        <p className="mt-4 text-sm text-slate-500">
          Q4 2026 pilots onboarding now with Founder pricing. Ask about onboarding incentives.
        </p>
      </section>

      <PricingPlans />

      <section className="mt-24 grid gap-10 lg:grid-cols-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            What it costs to piece it together
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Agencies running four separate tools pay the price of four sales teams, four passwords
            and four reconciliation headaches — typically far more than an all-in-one platform.
          </p>
          <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {STACK_EXISTING.map((row, index) => (
              <div
                key={row.tool}
                className={`flex items-center justify-between px-6 py-4 text-sm ${
                  index > 0 ? "border-t border-slate-100" : ""
                }`}
              >
                <span className="text-slate-700">{row.tool}</span>
                <span className="font-medium text-slate-500">{row.cost}</span>
              </div>
            ))}
            <div className="flex items-center justify-between border-t border-brand-100 bg-brand-50 px-6 py-4 text-sm">
              <span className="font-semibold text-brand-800">Typical 3–4 tool stack</span>
              <span className="font-semibold text-brand-800">≈ £550–£900/mo</span>
            </div>
            <div className="flex items-center justify-between border-t border-brand-600 px-6 py-4 text-sm">
              <span className="font-semibold text-slate-900">Pleasant — everything in one</span>
              <span className="font-semibold text-slate-900">from £149/mo</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-bold tracking-tight text-slate-900">
            Built to pay for itself
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Pleasant is the back office that runs itself. The closed loop — shift, clock-in, approved
            timesheet, payroll cost, client bill, live margin — means fewer payroll queries, faster
            invoicing and no reconciliation sprawl.
          </p>
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <Calculator className="h-6 w-6 text-brand-600" />
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              One filled shift without a phone call
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              An Agent Runner covers an absence by messaging the best-fit carers from the
              marketplace, confirms it on the rota and writes the hours straight into the payroll
              run — the margin appears the moment the clock-in lands.
            </p>
          </div>
          <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <ClipboardCheck className="h-6 w-6 text-brand-600" />
            <h3 className="mt-4 text-base font-semibold text-slate-900">
              Payroll that doesn&apos;t bounce back
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Approvals carry an audit trail and compliance checks, so HMRC queries and inspection
              weeks stop eating the week.
            </p>
          </div>
        </div>
      </section>

      <section className="mt-24">
        <h2 className="text-left text-2xl font-bold tracking-tight text-slate-900">
          Add-ons, priced by usage
        </h2>
        <p className="mt-3 text-left text-sm leading-relaxed text-slate-600">
          Attach what you need as you grow. Aultrum family products plug straight into your Pleasant
          account.
        </p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {ADDONS.map((addon) => (
            <div
              key={addon.title}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <addon.icon className="h-6 w-6 text-brand-600" />
              <h3 className="mt-4 text-base font-semibold text-slate-900">{addon.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{addon.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto mt-24 max-w-3xl text-center">
        <h2 className="text-3xl font-bold leading-tight tracking-tight text-slate-900">
          See the back office running itself.
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-slate-600">
          The demo agency is prefilled on the sign-in screen — schedule a shift, approve a timesheet
          and run a payroll cycle in minutes. Founder pricing is available while departments ramp.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700"
          >
            Enter the demo agency
          </Link>
          <a
            href="mailto:Wisdom@aultrum.co.uk"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Talk to us about a Q4 pilot
          </a>
        </div>
      </section>

      <footer className="mt-24 border-t border-slate-200 pt-6 text-sm text-slate-500">
        <p>
          Payroll figures are estimates based on published HMRC thresholds and must be validated
          before submission. Pleasant is part of the Aultrum family.
        </p>
        <nav className="mt-3 flex items-center gap-4">
          <Link href="/" className="hover:text-slate-700">
            Home
          </Link>
          <Link href="/pricing" className="hover:text-slate-700">
            Pricing
          </Link>
          <Link href="/login" className="hover:text-slate-700">
            Sign in
          </Link>
        </nav>
      </footer>
    </main>
  );
}