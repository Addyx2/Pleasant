import Link from "next/link";
import { BrainCircuit, CalendarClock, FileSpreadsheet, Link2, Mail, ShieldCheck } from "lucide-react";

import { ASSIST_MODEL } from "@/lib/assist/agent";
import { SCHEDULER_KEY, schedulerConfigured } from "@/lib/assist/automations";
import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, StatCard } from "@/components/ui";

import { PolicyForm, TestButton } from "./ConnectionsClient";

export const metadata = { title: "Connections · Assist" };
export const dynamic = "force-dynamic";

const ukTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

function Status({ on, onLabel = "Connected", offLabel = "Not set up" }: { on: boolean; onLabel?: string; offLabel?: string }) {
  return <Badge tone={on ? "green" : "amber"}>{on ? onLabel : offLabel}</Badge>;
}

function Connection({
  icon: Icon,
  title,
  status,
  children,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  status: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-slate-900">{title}</h3>
        </div>
        {status}
      </div>
      <div className="mt-3 flex-1 space-y-2 text-sm text-slate-600">{children}</div>
      {action ? <div className="mt-4 border-t border-slate-100 pt-4">{action}</div> : null}
    </Card>
  );
}

const code = (s: string) => <code className="rounded bg-slate-100 px-1 py-0.5 text-[12px] text-slate-700">{s}</code>;

export default async function ConnectionsPage() {
  const user = await requireOps();
  const isAdmin = user.role === "ADMIN";
  const since = new Date(Date.now() - 30 * 86_400_000);

  const [heartbeat, conversations, changes, runs] = await Promise.all([
    prisma.systemHeartbeat.findUnique({ where: { key: SCHEDULER_KEY } }),
    prisma.assistConversation.count({ where: { agencyId: user.agencyId, createdAt: { gte: since }, automationId: null } }),
    prisma.auditEvent.count({ where: { agencyId: user.agencyId, action: "assist.action", createdAt: { gte: since } } }),
    prisma.auditEvent.count({ where: { agencyId: user.agencyId, action: "assist.automation_run", createdAt: { gte: since } } }),
  ]);

  const modelOn = !!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  const emailOn = !!process.env.RESEND_API_KEY;
  const schedulerOn = schedulerConfigured();
  const tickRecent = !!heartbeat && Date.now() - heartbeat.at.getTime() < 60 * 60_000;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Conversations (30 days)" value={String(conversations)} hint="Across your agency" />
        <StatCard label="Changes made via Assist" value={String(changes)} hint="Each approved by a person" />
        <StatCard label="Automation runs" value={String(runs)} hint="Read-only, unattended" />
      </div>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Services</h2>
          <p className="text-xs text-slate-500">What Assist relies on, and whether it&apos;s working.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Connection
            icon={BrainCircuit}
            title="AI model"
            status={<Status on={modelOn} />}
            action={isAdmin ? <TestButton kind="model" label="Test connection" /> : undefined}
          >
            <p>
              Assist uses Anthropic&apos;s {code(ASSIST_MODEL)} model. Conversations are sent to Anthropic to generate
              replies; Pleasant never sends bank or NI numbers.
            </p>
            {!modelOn ? <p>Set {code("ANTHROPIC_API_KEY")} in your hosting environment to turn Assist on.</p> : null}
          </Connection>

          <Connection
            icon={Mail}
            title="Email"
            status={<Status on={emailOn} />}
            action={isAdmin ? <TestButton kind="email" label="Send me a test email" /> : undefined}
          >
            <p>Sends automation results, team invites and password resets through Resend.</p>
            {!emailOn ? (
              <p>
                Set {code("RESEND_API_KEY")} and {code("EMAIL_FROM")}. Until then, invites show a link to copy and
                automation results stay in History.
              </p>
            ) : null}
          </Connection>

          <Connection
            icon={CalendarClock}
            title="Scheduler"
            status={<Status on={schedulerOn && tickRecent} onLabel="Running" offLabel={schedulerOn ? "Not checking in" : "Not set up"} />}
          >
            <p>
              Runs your automations. {heartbeat ? `Last checked in ${ukTime.format(heartbeat.at)} UK time${heartbeat.detail ? ` (${heartbeat.detail})` : ""}.` : "It hasn't checked in yet."}
            </p>
            {!schedulerOn || !tickRecent ? (
              <p>
                Set {code("CRON_SECRET")} on the app, then add the {code("APP_URL")} and {code("CRON_SECRET")}{" "}
                repository secrets so the included GitHub Actions workflow calls {code("/api/cron/assist")} every 15
                minutes. Vercel Cron (paid plans) or any cron service can call it instead.
              </p>
            ) : null}
          </Connection>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
              <ShieldCheck className="h-4 w-4 text-brand-600" /> What Assist can access
            </h2>
            <p className="text-xs text-slate-500">
              Applies to everyone in {user.agency.name}, on top of each person&apos;s own role. &ldquo;Change&rdquo;
              always needs the person to approve each action; automations can only ever read.
            </p>
          </div>
          {isAdmin ? (
            <Link href="/settings/audit?category=assist" className="text-xs font-medium text-brand-700 hover:text-brand-800">
              Assist activity in the audit log →
            </Link>
          ) : null}
        </div>
        <Card className="p-4">
          <PolicyForm disabled={user.agency.assistDisabled} editable={isAdmin} />
        </Card>
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Exports &amp; portals</h2>
          <p className="text-xs text-slate-500">Other systems Pleasant exchanges data with. These are file-based today, not live syncs.</p>
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <Connection icon={FileSpreadsheet} title="Xero" status={<Badge tone="blue">CSV export</Badge>}>
            <p>Issued invoices export as a Xero sales-invoice import file.</p>
            {isAdmin ? (
              <Link href="/billing/xero" className="text-sm font-medium text-brand-700 hover:text-brand-800">Open Xero export →</Link>
            ) : null}
          </Connection>
          <Connection icon={FileSpreadsheet} title="HMRC & bank" status={<Badge tone="blue">File export</Badge>}>
            <p>Each pay run produces an RTI (FPS) file for HMRC and a BACS STD18 or CSV payment file for your bank.</p>
            {isAdmin ? (
              <Link href="/payroll" className="text-sm font-medium text-brand-700 hover:text-brand-800">Open payroll →</Link>
            ) : null}
          </Connection>
          <Connection icon={Link2} title="Pleasant Link" status={<Badge tone="green">Built in</Badge>}>
            <p>A secure portal for client signatories to approve timesheets and request staff, issued per signatory.</p>
            <Link href="/clients" className="text-sm font-medium text-brand-700 hover:text-brand-800">Manage on Clients →</Link>
          </Connection>
        </div>
      </section>
    </div>
  );
}
