import Link from "next/link";
import { CalendarDays, CheckCircle2, MessageSquareText, Plug, ReceiptText, TriangleAlert } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { DIVISIONS, getBankHolidays } from "@/lib/integrations/bank-holidays";
import { CATEGORY_LABELS, INTEGRATIONS, type IntegrationCategory, type IntegrationDefinition } from "@/lib/integrations/catalog";
import { displayPhone } from "@/lib/integrations/phone";
import { secretsOf } from "@/lib/integrations/store";
import type { TwilioConfig, TwilioSecrets } from "@/lib/integrations/twilio";
import type { XeroConfig } from "@/lib/integrations/xero/api";
import { xeroConfigured } from "@/lib/integrations/xero/oauth";
import { absoluteUrl } from "@/lib/url";
import { cn } from "@/lib/utils";
import { Badge, Card, buttonClass, inputClass } from "@/components/ui";

import {
  connectTwilioAction,
  disconnectAction,
  saveBankHolidaysAction,
  saveXeroSettingsAction,
  sendTestSmsAction,
  syncXeroAction,
} from "./actions";
import { ActionForm, CopyField, TestSmsForm, TwilioForm } from "./IntegrationForms";

export const metadata = { title: "Integrations · Settings" };
export const dynamic = "force-dynamic";

const ukDateTime = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ukDay = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", year: "numeric" });

const XERO_BANNERS: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Xero is connected. Invoices you issue from now on go to Xero automatically." },
  cancelled: { ok: false, text: "Xero wasn't connected: access was cancelled in Xero." },
  expired: { ok: false, text: "That Xero sign-in link expired. Try connecting again." },
  failed: { ok: false, text: "Xero couldn't be connected. Try again; if it keeps failing, contact Pleasant support." },
  "no-organisation": { ok: false, text: "No Xero organisation was chosen. Connect again and pick your organisation." },
  "not-configured": { ok: false, text: "Xero isn't available on this installation yet. Contact Pleasant support." },
};

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  xero: ReceiptText,
  twilio: MessageSquareText,
  "bank-holidays": CalendarDays,
};

function Shell({
  def,
  status,
  children,
  footer,
}: {
  def: IntegrationDefinition;
  status: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const Icon = ICONS[def.key] ?? Plug;
  return (
    <Card className="flex min-w-0 flex-col p-5" id={`integration-${def.key}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-600/10">
            <Icon className="h-4 w-4" />
          </span>
          <h3 className="font-semibold text-slate-900">{def.name}</h3>
        </div>
        {status}
      </div>
      <p className="mt-2 text-sm text-slate-600">{def.description}</p>
      <div className="mt-4 flex-1 space-y-4 text-sm text-slate-600">{children}</div>
      {footer ? <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">{footer}</div> : null}
    </Card>
  );
}

function Health({ status }: { status?: string }) {
  if (!status) return <Badge tone="slate">Not connected</Badge>;
  if (status === "ERROR") return <Badge tone="red">Needs attention</Badge>;
  return <Badge tone="green">Connected</Badge>;
}

function Problem({ text }: { text?: string | null }) {
  if (!text) return null;
  return (
    <p className="flex items-start gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      {text}
    </p>
  );
}

function Disconnect({ provider, name }: { provider: string; name: string }) {
  return (
    <form action={disconnectAction}>
      <input type="hidden" name="provider" value={provider} />
      <button type="submit" className="text-xs font-medium text-slate-500 hover:text-red-700">
        Disconnect {name}
      </button>
    </form>
  );
}

const dt = "text-xs text-slate-500";
const dd = "font-medium text-slate-800";

export default async function IntegrationsPage({ searchParams }: { searchParams: Promise<{ xero?: string }> }) {
  const user = await requireAdmin();
  const { xero: xeroResult } = await searchParams;
  const since30 = new Date(Date.now() - 30 * 86_400_000);

  const [rows, logs, holidays, holidayBeat, xeroCounts, smsCounts] = await Promise.all([
    prisma.integration.findMany({ where: { agencyId: user.agencyId } }),
    prisma.integrationLog.findMany({ where: { agencyId: user.agencyId }, orderBy: { createdAt: "desc" }, take: 12 }),
    getBankHolidays(user.agency.bankHolidayDivision),
    prisma.systemHeartbeat.findUnique({ where: { key: "bank-holidays" } }),
    prisma.invoice.groupBy({
      by: ["status"],
      where: { agencyId: user.agencyId, xeroInvoiceId: { not: null } },
      _count: true,
    }),
    prisma.smsMessage.groupBy({
      by: ["direction"],
      where: { agencyId: user.agencyId, createdAt: { gte: since30 } },
      _count: true,
    }),
  ]);
  const byKey = new Map(rows.map((r) => [r.provider, r]));
  const xero = byKey.get("xero");
  const twilio = byKey.get("twilio");
  const xeroConfig = (xero?.config ?? {}) as Partial<XeroConfig>;
  const twilioConfig = (twilio?.config ?? {}) as Partial<TwilioConfig>;
  const inboundUrl = twilio ? await absoluteUrl(`/api/webhooks/twilio/${twilio.id}`) : "";
  const inXero = xeroCounts.reduce((n, c) => n + c._count, 0);
  const paidInXero = xeroCounts.find((c) => c.status === "PAID")?._count ?? 0;
  const textsOut = smsCounts.find((c) => c.direction === "OUT")?._count ?? 0;
  const textsIn = smsCounts.find((c) => c.direction === "IN")?._count ?? 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const upcoming = [...holidays].filter((d) => d >= todayKey).sort().slice(0, 3);
  const banner = xeroResult ? XERO_BANNERS[xeroResult] : undefined;
  const connectedCount = rows.length + 1; // bank holidays are always on

  const live: Record<string, React.ReactNode> = {
    xero: (
      <Shell
        def={INTEGRATIONS.find((i) => i.key === "xero")!}
        status={<Health status={xero?.status} />}
        footer={
          xero ? (
            <>
              <ActionForm action={syncXeroAction} submitLabel="Sync now" pendingLabel="Syncing with Xero…" subtle className="flex-1" />
              <Disconnect provider="xero" name="Xero" />
            </>
          ) : xeroConfigured() ? (
            <a href="/api/integrations/xero/connect" className={cn(buttonClass, "py-1.5")}>
              Connect Xero
            </a>
          ) : (
            <p className="text-xs text-slate-500">Xero isn&apos;t available on this installation yet. Contact Pleasant support.</p>
          )
        }
      >
        {xero ? (
          <>
            <dl className="grid grid-cols-2 gap-3">
              <div>
                <dt className={dt}>Organisation</dt>
                <dd className={dd}>{xeroConfig.tenantName ?? "Xero"}</dd>
              </div>
              <div>
                <dt className={dt}>Last synced</dt>
                <dd className={dd}>{xero.lastSyncAt ? ukDateTime.format(xero.lastSyncAt) : "Not yet"}</dd>
              </div>
              <div>
                <dt className={dt}>Invoices in Xero</dt>
                <dd className={dd}>{inXero}</dd>
              </div>
              <div>
                <dt className={dt}>Paid via Xero</dt>
                <dd className={dd}>{paidInXero}</dd>
              </div>
            </dl>
            <Problem text={xero.status === "ERROR" ? xero.lastError : null} />
            <details className="group rounded-lg border border-slate-200 px-3 py-2">
              <summary className="cursor-pointer text-xs font-medium text-slate-700">Sync settings</summary>
              <ActionForm action={saveXeroSettingsAction} submitLabel="Save settings" subtle className="mt-3">
                <div className="grid gap-3 sm:grid-cols-3">
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    New invoices in Xero are
                    <select name="invoiceStatus" defaultValue={xeroConfig.invoiceStatus ?? "AUTHORISED"} className={cn(inputClass, "py-1.5")}>
                      <option value="AUTHORISED">Approved</option>
                      <option value="DRAFT">Drafts to review</option>
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Sales account code
                    <input name="accountCode" defaultValue={xeroConfig.accountCode ?? "200"} className={cn(inputClass, "py-1.5")} />
                  </label>
                  <label className="space-y-1 text-xs font-medium text-slate-600">
                    Send invoices issued from
                    <input type="date" name="syncFrom" defaultValue={xeroConfig.syncFrom} className={cn(inputClass, "py-1.5")} />
                  </label>
                </div>
                <p className="text-xs text-slate-500">
                  Invoices issued before this date aren&apos;t sent, so ones already in Xero (for example from the CSV export) aren&apos;t
                  duplicated. Payments recorded in Xero only come back for approved invoices.
                </p>
              </ActionForm>
            </details>
          </>
        ) : (
          <ul className="list-disc space-y-1 pl-4 text-sm">
            <li>Clients are created as Xero contacts the first time they&apos;re invoiced.</li>
            <li>Issuing or voiding an invoice updates Xero straight away.</li>
            <li>Every hour, invoices paid in Xero are marked paid here.</li>
          </ul>
        )}
      </Shell>
    ),
    twilio: (
      <Shell
        def={INTEGRATIONS.find((i) => i.key === "twilio")!}
        status={<Health status={twilio?.status} />}
        footer={twilio ? <Disconnect provider="twilio" name="SMS" /> : undefined}
      >
        {twilio ? (
          <dl className="grid grid-cols-2 gap-3">
            <div>
              <dt className={dt}>Sending from</dt>
              <dd className={dd}>{twilioConfig.from ? displayPhone(twilioConfig.from) : "–"}</dd>
            </div>
            <div>
              <dt className={dt}>Texts, last 30 days</dt>
              <dd className={dd}>
                {textsOut} sent · {textsIn} replies
              </dd>
            </div>
          </dl>
        ) : null}
        {twilio ? <Problem text={twilio.status === "ERROR" ? twilio.lastError : null} /> : null}
        <TwilioForm
          action={connectTwilioAction}
          connected={!!twilio}
          defaults={{ accountSid: secretsOf<TwilioSecrets>(twilio ?? null)?.accountSid ?? "", from: twilioConfig.from ?? "", offers: twilioConfig.offers ?? true }}
        />
        {twilio ? (
          <>
            <div className="space-y-1.5">
              <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                {twilioConfig.webhookSet ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" /> : <TriangleAlert className="h-3.5 w-3.5 text-amber-600" />}
                {twilioConfig.webhookSet ? "Replies come into Pleasant automatically." : "To receive replies, set this as the number's “A message comes in” webhook (HTTP POST) in Twilio:"}
              </p>
              {!twilioConfig.webhookSet ? <CopyField value={inboundUrl} label="Copy webhook address" /> : null}
            </div>
            <TestSmsForm action={sendTestSmsAction} />
          </>
        ) : (
          <p className="text-xs text-slate-500">
            You&apos;ll need a Twilio account with a UK number that can send SMS. Texts are billed by Twilio to your account. Carers
            need a mobile number on their profile.
          </p>
        )}
      </Shell>
    ),
    "bank-holidays": (
      <Shell def={INTEGRATIONS.find((i) => i.key === "bank-holidays")!} status={<Badge tone="green">Always on</Badge>}>
        <ActionForm action={saveBankHolidaysAction} submitLabel="Save" subtle>
          <label className="block space-y-1 text-xs font-medium text-slate-600">
            Your bank holidays
            <select name="division" defaultValue={user.agency.bankHolidayDivision} className={cn(inputClass, "py-1.5")}>
              {Object.entries(DIVISIONS).map(([key, name]) => (
                <option key={key} value={key}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </ActionForm>
        <div>
          <p className={dt}>Coming up</p>
          <ul className="mt-1 space-y-0.5">
            {upcoming.length ? upcoming.map((d) => <li key={d} className={dd}>{ukDay.format(new Date(`${d}T00:00:00Z`))}</li>) : <li>None listed yet.</li>}
          </ul>
        </div>
        <p className="text-xs text-slate-500">
          {holidayBeat ? `Updated from GOV.UK ${ukDateTime.format(holidayBeat.at)}.` : "Using the built-in calendar until the first update from GOV.UK."}
        </p>
      </Shell>
    ),
  };

  const categories = Object.keys(CATEGORY_LABELS) as IntegrationCategory[];

  return (
    <div className="space-y-8">
      {banner ? (
        <p
          role="status"
          className={cn(
            "flex items-start gap-2 rounded-xl px-4 py-3 text-sm",
            banner.ok ? "bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200" : "bg-red-50 text-red-700 ring-1 ring-red-200",
          )}
        >
          {banner.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
          {banner.text}
        </p>
      ) : null}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Integrations</h2>
          <p className="text-sm text-slate-500">
            Live connections between Pleasant and the services your agency already uses. {connectedCount} of{" "}
            {INTEGRATIONS.filter((i) => i.availability === "live").length} available are on.
          </p>
        </div>
        <Link href="/settings/audit?category=integration" className="text-xs font-medium text-brand-700 hover:text-brand-800">
          Connection changes in the audit log →
        </Link>
      </div>

      {categories.map((category) => {
        const defs = INTEGRATIONS.filter((i) => i.category === category);
        return (
          <section key={category} className="space-y-3" aria-labelledby={`cat-${category}`}>
            <h3 id={`cat-${category}`} className="text-sm font-semibold text-slate-900">
              {CATEGORY_LABELS[category]}
            </h3>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
              {defs.map((def) =>
                def.availability === "live" ? (
                  <div key={def.key} className="contents">{live[def.key]}</div>
                ) : (
                  <Card key={def.key} className="flex flex-col self-start border-dashed p-5 opacity-80">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold text-slate-700">{def.name}</h4>
                      <Badge tone="slate">Planned</Badge>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{def.description}</p>
                  </Card>
                ),
              )}
            </div>
          </section>
        );
      })}

      <section className="space-y-3" aria-labelledby="int-activity">
        <h3 id="int-activity" className="text-sm font-semibold text-slate-900">
          Recent activity
        </h3>
        <Card className="overflow-x-auto p-0">
          {logs.length ? (
            <table className="w-full text-left text-sm">
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-4 py-2 text-xs text-slate-500">{ukDateTime.format(log.createdAt)}</td>
                    <td className="whitespace-nowrap px-4 py-2 text-slate-700">
                      {INTEGRATIONS.find((i) => i.key === log.provider)?.name ?? log.provider}
                    </td>
                    <td className="px-4 py-2 text-slate-600">
                      <span className={cn("mr-2 inline-block h-1.5 w-1.5 rounded-full align-middle", log.ok ? "bg-emerald-500" : "bg-red-500")} aria-hidden="true" />
                      <span className="sr-only">{log.ok ? "Succeeded: " : "Failed: "}</span>
                      {log.detail}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="px-4 py-6 text-sm text-slate-500">Nothing yet. Syncs, texts and connection tests show here.</p>
          )}
        </Card>
      </section>
    </div>
  );
}
