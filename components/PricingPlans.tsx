"use client";

import { useState } from "react";
import { ArrowRight, Check } from "lucide-react";

const ANNUAL_DISCOUNT = 0.83;

type Plan = {
  name: string;
  tagline: string;
  monthly: number;
  included: number | null;
  extraRate: number | null;
  seatRate?: number;
  cta: { label: string; href: string; variant: "primary" | "outline" };
  popular?: boolean;
  features: string[];
};

const PLANS: Plan[] = [
  {
    name: "Starter",
    tagline: "Scheduling and timesheets for a growing team.",
    monthly: 149,
    included: null,
    extraRate: null,
    seatRate: 4,
    cta: { label: "Start with the demo", href: "/login", variant: "primary" },
    features: [
      "Worker app: clock in/out, e-sign-off",
      "Shift scheduling & open-shift offers",
      "Timesheet approvals & audit trail",
      "Email support",
    ],
  },
  {
    name: "Pro",
    tagline: "The full back office for a staffing agency.",
    monthly: 524,
    included: 40,
    extraRate: 4,
    cta: { label: "Start with the demo", href: "/login", variant: "primary" },
    features: [
      "Everything in Starter",
      "Open-shift marketplace & matching",
      "UK payroll engine, PAYE & NI, payslips",
      "Client billing & margin on every placement",
      "Limited automations",
    ],
  },
  {
    name: "Scale",
    tagline: "Advanced placements, automations and finance sync.",
    monthly: 1236,
    included: 150,
    extraRate: 3,
    popular: true,
    cta: { label: "Start with the demo", href: "/login", variant: "primary" },
    features: [
      "Everything in Pro",
      "Placement tracking & AI shift matching",
      "Expanded automations",
      "Xero / QuickBooks sync",
      "Priority support & dedicated CSM",
    ],
  },
  {
    name: "Enterprise",
    tagline: "Multi-branch, HR suite and enterprise controls.",
    monthly: 2500,
    included: null,
    extraRate: null,
    cta: { label: "Contact us", href: "mailto:Wisdom@aultrum.co.uk", variant: "outline" },
    features: [
      "Everything in Scale",
      "HR suite: records, policies, onboarding",
      "Multi-branch / multi-agency",
      "Unlimited automations & Agent Runners",
      "SLA, API, SSO, dedicated account team",
    ],
  },
];

export default function PricingPlans() {
  const [annual, setAnnual] = useState(false);

  return (
    <section className="mt-16" id="plans">
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-sm font-medium text-slate-600 shadow-sm">
          <button
            type="button"
            onClick={() => setAnnual(false)}
            className={`rounded-full px-4 py-1.5 ${
              !annual ? "bg-brand-600 text-white" : "hover:text-slate-900"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setAnnual(true)}
            className={`rounded-full px-4 py-1.5 ${
              annual ? "bg-brand-600 text-white" : "hover:text-slate-900"
            }`}
          >
            Annual <span className={annual ? "text-brand-100" : "text-brand-600"}>−17%</span>
          </button>
        </div>
      </div>

      <div className="mt-10 grid gap-5 lg:grid-cols-4">
        {PLANS.map((plan) => {
          const price = annual ? Math.round(plan.monthly * ANNUAL_DISCOUNT) : plan.monthly;
          return (
            <div
              key={plan.name}
              className={`flex flex-col rounded-2xl border bg-white p-6 shadow-sm ${
                plan.popular ? "border-brand-600 ring-2 ring-brand-600" : "border-slate-200"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">{plan.name}</h2>
                {plan.popular && (
                  <span className="rounded-full bg-brand-600 px-2.5 py-0.5 text-xs font-semibold text-white">
                    Most popular
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-slate-500">{plan.tagline}</p>

              <div className="mt-6">
                {plan.seatRate ? (
                  <span className="text-2xl font-semibold text-slate-500">From </span>
                ) : null}
                <span className="text-5xl font-bold tracking-tight text-slate-900">
                  £{price.toLocaleString("en-GB")}
                </span>
                <span className="text-base text-slate-500">/mo</span>
                {annual && (
                  <p className="mt-1 text-xs text-slate-500">billed annually with Pleasant</p>
                )}
              </div>

              {plan.seatRate ? (
                <p className="mt-3 text-sm text-slate-600">
                  <strong>+£{plan.seatRate} per active carer/mo</strong> — pay only for carers who
                  worked that month.
                </p>
              ) : plan.included !== null ? (
                <p className="mt-3 text-sm text-slate-600">
                  Includes <strong>{plan.included} active carers</strong> · £{plan.extraRate} per
                  extra active carer/mo
                </p>
              ) : (
                <p className="mt-3 text-sm text-slate-600">Custom quotations from this price.</p>
              )}

              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-sm text-slate-600">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" />
                    {feature}
                  </li>
                ))}
              </ul>

              <div className="mt-8 flex-1 flex flex-col justify-end">
                <a
                  href={plan.cta.href}
                  className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold ${
                    plan.cta.variant === "primary"
                      ? "bg-brand-600 text-white hover:bg-brand-700"
                      : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {plan.cta.label} <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-6 text-center text-sm text-slate-500">
        An active carer is anyone who clocked in at least once that month. You are never billed for
        carers who sat idle.
      </p>
    </section>
  );
}