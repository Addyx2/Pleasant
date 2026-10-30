import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Building2,
  Fingerprint,
  Gauge,
  GraduationCap,
  HeartHandshake,
  MessagesSquare,
  PlugZap,
  Repeat,
  ShieldCheck,
  Smile,
  Sparkles,
  Star,
  UserRound,
  Users,
} from "lucide-react";

import { requireOps } from "@/lib/auth";
import { expiryState } from "@/lib/compliance";
import { prisma } from "@/lib/db";
import { qualifiers, summarise } from "@/lib/qualifiers";
import { Badge, Card } from "@/components/ui";
import { cn } from "@/lib/utils";

export const metadata = { title: "Persona" };
export const dynamic = "force-dynamic";

type Status = "live" | "partial" | "planned" | "horizon";

const STATUS: Record<Status, { label: string; tone: "green" | "blue" | "amber" | "slate" }> = {
  live: { label: "Live", tone: "green" },
  partial: { label: "Partly live", tone: "blue" },
  planned: { label: "Next", tone: "amber" },
  horizon: { label: "Later", tone: "slate" },
};

function Layer({
  numeral,
  icon: Icon,
  title,
  status,
  anchors,
  children,
  href,
  linkLabel,
}: {
  numeral: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: Status;
  anchors: string;
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 text-brand-300">
            <Icon className="h-4 w-4" />
          </span>
          <div className="leading-tight">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Layer {numeral}</p>
            <h3 className="font-semibold text-slate-900">{title}</h3>
          </div>
        </div>
        <Badge tone={STATUS[status].tone}>{STATUS[status].label}</Badge>
      </div>
      <div className="mt-3 flex-1 space-y-2 text-sm text-slate-600">{children}</div>
      <p className="mt-3 text-xs text-slate-400">Anchored in {anchors}</p>
      {href ? (
        <Link href={href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800">
          {linkLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ) : null}
    </Card>
  );
}

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div>
      <p className="font-display text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}

export default async function PersonaPage() {
  const user = await requireOps();
  const now = new Date();
  const since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [running, filled, index] = await Promise.all([
    prisma.pushbotCampaign.count({ where: { agencyId: user.agencyId, status: "RUNNING" } }),
    prisma.pushbotCampaign.count({ where: { agencyId: user.agencyId, outcome: "filled", createdAt: { gte: since } } }),
    qualifiers(user.agencyId).then(summarise),
  ]);
  const [staff, conversations, actions, automations, clients] = await Promise.all([
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: { not: "INACTIVE" } },
      select: { dbsExpiry: true, rightToWork: { select: { expiryDate: true } }, trainingRecords: { select: { expiryDate: true } } },
    }),
    prisma.assistConversation.count({ where: { userId: user.id, updatedAt: { gte: since } } }),
    prisma.auditEvent.count({ where: { agencyId: user.agencyId, action: "assist.action", createdAt: { gte: since } } }),
    prisma.assistAutomation.count({ where: { userId: user.id, enabled: true } }),
    prisma.client.count({ where: { agencyId: user.agencyId } }),
  ]);

  const failing = (state: string) => state === "EXPIRED" || state === "MISSING";
  const clear = staff.filter(
    (s) =>
      !failing(expiryState(s.dbsExpiry, now)) &&
      s.rightToWork !== null &&
      !failing(expiryState(s.rightToWork.expiryDate, now)) &&
      !s.trainingRecords.some((t) => expiryState(t.expiryDate, now) === "EXPIRED"),
  ).length;
  const withTraining = staff.filter((s) => s.trainingRecords.length > 0).length;

  const flow = [
    { icon: Building2, label: "Providers", detail: "Your agency" },
    { icon: Users, label: "Carers", detail: "Abilities" },
    { icon: HeartHandshake, label: "Clients & units", detail: "Needs" },
    { icon: UserRound, label: "Service users", detail: "The care itself" },
  ];

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-2xl bg-slate-900 p-6 text-white sm:p-8">
        <div className="flex items-center gap-2 text-brand-300">
          <Fingerprint className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-[0.2em]">Persona</span>
        </div>
        <h1 className="mt-3 max-w-3xl font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
          The AI that understands care delivery, from the providers who supply it to the service users who receive it.
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-slate-300">
          Persona maps every carer&apos;s abilities to every client&apos;s needs, layer by layer. Every judgement shows its
          working, and people stay in charge of every decision.
        </p>
        <ol className="mt-6 grid gap-2 sm:grid-cols-4">
          {flow.map((step, i) => (
            <li key={step.label} className="flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2.5 rounded-xl bg-white/5 px-3 py-2.5 ring-1 ring-white/10">
                <step.icon className="h-4 w-4 shrink-0 text-brand-300" />
                <div className="leading-tight">
                  <p className="text-sm font-semibold">{step.label}</p>
                  <p className="text-[11px] text-slate-400">{step.detail}</p>
                </div>
              </div>
              {i < flow.length - 1 ? <ArrowRight className="hidden h-4 w-4 shrink-0 text-slate-500 sm:block" /> : null}
            </li>
          ))}
        </ol>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Persona&apos;s functions</h2>
          <p className="text-xs text-slate-500">Three agents on the same layers: one talks to carers, one works with the office, one keeps score.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          {[
            { href: "/persona/pushbots", icon: Bot, title: "Pushbots", text: "Fills open shifts by text, a few carers at a time, and answers carers' texts as them.", stat: `${running} filling now · ${filled} filled in 30 days` },
            { href: "/persona/assist", icon: Sparkles, title: "Assist", text: "Ask about anything in Pleasant, or tell it what to do. Every change waits for your approval.", stat: `${actions} changes approved in 30 days` },
            { href: "/persona/qualifiers", icon: Gauge, title: "Qualifiers", text: "Indexes every carer across reliability, quality, readiness and competence, with compliance as a gate.", stat: index.index === null ? "Not enough history yet" : `Agency index ${index.index} · ${index.toReview.length} to review` },
          ].map((f) => (
            <Link key={f.href} href={f.href} className="group">
              <Card className="h-full p-5 transition group-hover:border-brand-300">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
                    <f.icon className="h-4 w-4 text-brand-300" />
                  </span>
                  <h3 className="font-semibold text-slate-900">{f.title}</h3>
                  <Badge tone="green">Live</Badge>
                </div>
                <p className="mt-3 text-sm text-slate-600">{f.text}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">{f.stat}</p>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Assist</h2>
          <p className="text-xs text-slate-500">Persona&apos;s agent: ask about anything in Pleasant, or tell it what to do.</p>
        </div>
        <Card className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900">
                <Sparkles className="h-5 w-5 text-brand-300" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-slate-900">Assist</h3>
                  <Badge tone="green">Live</Badge>
                </div>
                <p className="text-sm text-slate-600">Answers from live data and does the work. Every change waits for your approval.</p>
              </div>
            </div>
            <Link
              href="/persona/assist"
              className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Open Assist <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-5 grid gap-4 border-t border-slate-100 pt-5 sm:grid-cols-3">
            <Stat value={conversations} label="Your conversations, last 30 days" />
            <Stat value={actions} label="Changes approved across the agency, last 30 days" />
            <Stat value={automations} label="Your active automations" />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            {[
              { href: "/persona/assist", icon: MessagesSquare, label: "Chats" },
              { href: "/persona/assist/automations", icon: Repeat, label: "Automations" },
              { href: "/persona/assist/connections", icon: PlugZap, label: "Connections" },
            ].map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50/60"
              >
                <l.icon className="h-3.5 w-3.5 text-brand-600" /> {l.label}
              </Link>
            ))}
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Foundation layers</h2>
          <p className="text-xs text-slate-500">
            Can this carer safely and capably do this shift? Each layer is anchored in an established legal, clinical or
            research framework.
          </p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Layer
            numeral="I"
            icon={GraduationCap}
            title="Competence"
            status="partial"
            anchors="the Care Certificate, the RQF, the Core Skills Training Framework and NICE guidance."
            href="/staff"
            linkLabel="Workers and training"
          >
            <p>Skills matched to this client&apos;s needs, not just credentials held.</p>
            <p>
              <span className="font-semibold text-slate-900">Today:</span> roles and training records ({withTraining} of{" "}
              {staff.length} active carers have training on file).
            </p>
            <p>
              <span className="font-semibold text-slate-900">Next:</span> a skills catalogue with assessed levels, and the
              skills each of your {clients} clients&apos; units require.
            </p>
          </Layer>
          <Layer
            numeral="II"
            icon={ShieldCheck}
            title="Compliance"
            status="partial"
            anchors="the CQC fundamental standards, the DBS, the Mental Capacity Act 2005 and UK GDPR."
            href="/compliance"
            linkLabel="Open compliance"
          >
            <p>A gate, not a trade-off: one failed check rules a placement out.</p>
            <p>
              <span className="font-semibold text-slate-900">Today:</span> DBS, right to work and training expiry.{" "}
              <span className={cn("font-semibold", clear === staff.length ? "text-emerald-700" : "text-amber-700")}>
                {clear} of {staff.length}
              </span>{" "}
              active carers are clear.
            </p>
            <p>
              <span className="font-semibold text-slate-900">Next:</span> a pass/fail gate that blocks unsafe bookings and
              records the evidence on every shift.
            </p>
          </Layer>
          <Layer
            numeral="III"
            icon={Gauge}
            title="Shift Readiness"
            status="planned"
            anchors="fatigue-risk-management research and the Working Time Regulations 1998."
          >
            <p>Protecting the carer&apos;s capacity to care is protecting the client.</p>
            <p>
              <span className="font-semibold text-slate-900">Today:</span> Assist won&apos;t book a carer onto overlapping
              shifts.
            </p>
            <p>
              <span className="font-semibold text-slate-900">Next:</span> a readiness index from hours worked, rest between
              shifts, consecutive nights and days without a break.
            </p>
          </Layer>
        </div>
      </section>

      <section>
        <div className="mb-3">
          <h2 className="text-sm font-semibold text-slate-900">Relationship and outcome layers</h2>
          <p className="text-xs text-slate-500">Built on the foundation once it is proven.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            { n: "IV", icon: HeartHandshake, title: "Rapport", text: "The bond between a carer and the people they care for, protected when rotas change." },
            { n: "V", icon: Smile, title: "Satisfaction", text: "Whether care worked, for the service user and for the carer." },
            { n: "VI", icon: Star, title: "Purpose", text: "Why carers stay: autonomy, competence and relatedness." },
          ].map((l) => (
            <div key={l.n} className="rounded-xl border border-dashed border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <l.icon className="h-4 w-4 text-slate-400" />
                  <p className="text-sm font-semibold text-slate-700">
                    <span className="text-slate-400">{l.n} · </span>
                    {l.title}
                  </p>
                </div>
                <Badge tone="slate">Later</Badge>
              </div>
              <p className="mt-2 text-xs text-slate-500">{l.text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
