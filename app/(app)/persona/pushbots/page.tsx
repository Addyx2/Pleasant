import Link from "next/link";
import { Bot, CheckCircle2, Clock, MessageSquareText, Send, TriangleAlert } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { smsSender } from "@/lib/integrations/sms";
import { pushbotsAiAvailable } from "@/lib/pushbots/agent";
import { historySince } from "@/lib/pushbots/campaign";
import { rankForShift, whyNot } from "@/lib/pushbots/eligibility";
import { Badge, Card, EmptyState, StatCard, buttonClass, subtleButtonClass } from "@/components/ui";

import { startCampaignAction, stopCampaignAction } from "./actions";

export const metadata = { title: "Pushbots" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const hm = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit" });
const person = (s: { firstName: string; lastName: string } | null | undefined) => (s ? `${s.firstName} ${s.lastName}`.trim() : "—");
const place = (s: { client: Parameters<typeof clientName>[0]; site: { name: string } | null; title: string }) =>
  [clientName(s.client, ""), s.site?.name].filter(Boolean).join(", ") || s.title;

function minutes(ms: number) {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

const OUTCOME: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
  filled: { label: "Filled", tone: "green" },
  exhausted: { label: "Nobody left to ask", tone: "red" },
  expired: { label: "Ran out of time", tone: "amber" },
  cancelled: { label: "Stopped", tone: "slate" },
};

export default async function PushbotsPage({ searchParams }: { searchParams: Promise<{ error?: string; started?: string }> }) {
  const user = await requireOps();
  const { error, started } = await searchParams;
  const since = historySince();
  const now = new Date();

  const [sender, running, recent, open] = await Promise.all([
    smsSender(user.agencyId),
    prisma.pushbotCampaign.findMany({
      where: { agencyId: user.agencyId, status: "RUNNING" },
      include: { shift: { include: { client: true, site: true, shiftOffers: { include: { staff: true }, orderBy: { offeredAt: "asc" } } } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.pushbotCampaign.findMany({
      where: { agencyId: user.agencyId, status: { not: "RUNNING" }, createdAt: { gte: since } },
      include: { shift: { include: { client: true, site: true } }, claimedBy: true },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.shift.findMany({
      where: {
        agencyId: user.agencyId,
        staffId: null,
        status: { in: ["OPEN", "UNATTENDED"] },
        startAt: { gt: now, lt: new Date(now.getTime() + 14 * 86_400_000) },
        pushbotCampaigns: { none: { status: "RUNNING" } },
      },
      include: { client: true, site: true },
      orderBy: { startAt: "asc" },
      take: 15,
    }),
  ]);

  // Who could be offered each open shift, and why others can't, before anyone presses Fill.
  const readiness = new Map(
    await Promise.all(
      [...open.map((s) => s.id), ...recent.filter((c) => c.outcome === "exhausted" && c.shift.startAt > now).slice(0, 5).map((c) => c.shiftId)].map(
        async (id) => [id, await rankForShift(user.agencyId, id)] as const,
      ),
    ),
  );
  const filled = recent.filter((c) => c.outcome === "filled");
  const fillTimes = filled.flatMap((c) => (c.endedAt ? [c.endedAt.getTime() - c.createdAt.getTime()] : [])).sort((a, b) => a - b);
  const median = fillTimes.length ? fillTimes[Math.floor(fillTimes.length / 2)] : null;
  const ai = pushbotsAiAvailable();
  const texted = new Set(
    (await prisma.smsMessage.findMany({ where: { offerId: { in: running.flatMap((c) => c.shift.shiftOffers.map((o) => o.id)) }, status: "SENT" }, select: { offerId: true } })).map((m) => m.offerId),
  );

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}
      {started ? <p role="status" className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Pushbots has started. The first carers have their offer.</p> : null}

      {!sender ? (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-amber-200 bg-amber-50/60 p-4">
          <p className="text-sm text-amber-900">
            <span className="font-semibold">Texting isn&apos;t connected.</span> Pushbots still offers shifts in the carers&apos; apps; connect Twilio to text them too.
          </p>
          <Link href="/settings/integrations" className={subtleButtonClass}>Connect texting</Link>
        </Card>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Filling now" value={String(running.length)} icon={Send} />
        <StatCard label="Filled, last 30 days" value={String(filled.length)} hint={recent.length ? `of ${recent.length} it tried` : undefined} icon={CheckCircle2} tone="green" />
        <StatCard label="Typical time to fill" value={median === null ? "—" : minutes(median)} icon={Clock} tone="blue" />
        <StatCard label="Answers carers' texts" value={ai ? "On" : "Off"} hint={ai ? "As each carer, and only them" : "Needs ANTHROPIC_API_KEY"} icon={MessageSquareText} tone={ai ? "green" : "slate"} />
      </div>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Filling now</h2>
        {running.length === 0 ? (
          <EmptyState icon={Bot} title="Nothing being filled" description="Start Pushbots on an open shift below. It offers it a few carers at a time until someone says yes." />
        ) : (
          <div className="space-y-3">
            {running.map((c) => (
              <Card key={c.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <Link href={`/shifts/${c.shiftId}`} className="font-semibold text-slate-900 hover:text-brand-700">
                      {fmt.format(c.shift.startAt)}–{hm.format(c.shift.endAt)} · {place(c.shift)}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.shift.role} · wave {c.wave}, {c.waveSize} at a time
                      {c.nextWaveAt ? ` · next wave ${hm.format(c.nextWaveAt)} if nobody takes it` : ""}
                    </p>
                  </div>
                  <form action={stopCampaignAction}>
                    <input type="hidden" name="campaignId" value={c.id} />
                    <button type="submit" className={subtleButtonClass}>Stop</button>
                  </form>
                </div>
                <ul className="mt-3 divide-y divide-slate-100 rounded-lg border border-slate-100">
                  {c.shift.shiftOffers.filter((o) => o.campaignId === c.id).map((o) => (
                    <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                      <span className="font-medium text-slate-800">{person(o.staff)}</span>
                      <span className="flex-1 text-xs text-slate-500">{o.note}</span>
                      <span className="flex items-center gap-2">
                        {texted.has(o.id) ? <Badge tone="blue">Texted</Badge> : <Badge tone="slate">In app</Badge>}
                        <Badge tone={o.status === "ACCEPTED" ? "green" : o.status === "DECLINED" ? "red" : "amber"}>
                          {o.status === "OFFERED" ? "Waiting" : o.status === "ACCEPTED" ? "Took it" : "Said no"}
                        </Badge>
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Open shifts, next 14 days</h2>
        {open.length === 0 ? (
          <p className="text-sm text-slate-500">No open shifts without a carer.</p>
        ) : (
          <Card className="divide-y divide-slate-100">
            {open.map((s) => (
              <form key={s.id} action={startCampaignAction} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <input type="hidden" name="shiftId" value={s.id} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-900">{fmt.format(s.startAt)}–{hm.format(s.endAt)} · {place(s)}</p>
                  <p className="text-xs text-slate-500">
                    {s.role}
                    {s.status === "UNATTENDED" ? " · carer dropped out" : ""}
                    {" · "}
                    <ReadyLine r={readiness.get(s.id)} />
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <label className="flex items-center gap-1">
                    <input name="waveSize" type="number" min={1} max={20} defaultValue={5} className="w-14 rounded-md border border-slate-300 px-2 py-1 text-sm" aria-label="Carers per wave" /> at a time,
                  </label>
                  <label className="flex items-center gap-1">
                    every <input name="waveGapMins" type="number" min={5} max={240} defaultValue={15} className="w-16 rounded-md border border-slate-300 px-2 py-1 text-sm" aria-label="Minutes between waves" /> min
                  </label>
                  <button type="submit" className={buttonClass}>
                    <Bot className="h-4 w-4" /> Fill
                  </button>
                </div>
              </form>
            ))}
          </Card>
        )}
      </section>

      <section>
        <h2 className="mb-2 text-sm font-semibold text-slate-900">Last 30 days</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing yet.</p>
        ) : (
          <Card className="divide-y divide-slate-100">
            {recent.map((c) => {
              const o = OUTCOME[c.outcome ?? ""] ?? { label: c.status, tone: "slate" as const };
              return (
                <div key={c.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/shifts/${c.shiftId}`} className="font-medium text-slate-900 hover:text-brand-700">
                      {fmt.format(c.shift.startAt)} · {place(c.shift)}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {c.offersSent} offered over {c.wave} wave{c.wave === 1 ? "" : "s"}
                      {c.outcome === "filled" && c.endedAt ? ` · ${person(c.claimedBy)} took it after ${minutes(c.endedAt.getTime() - c.createdAt.getTime())}` : ""}
                    </p>
                    {readiness.get(c.shiftId) ? (
                      <p className="text-xs text-amber-800">Why nobody, as things stand: {whyNot(readiness.get(c.shiftId)!.excluded).join("; ") || "everyone eligible has been asked"}</p>
                    ) : null}
                  </div>
                  <span className="flex items-center gap-1.5">
                    {c.outcome === "exhausted" || c.outcome === "expired" ? <TriangleAlert className="h-4 w-4 text-amber-600" /> : null}
                    <Badge tone={o.tone}>{o.label}</Badge>
                  </span>
                </div>
              );
            })}
          </Card>
        )}
      </section>
    </div>
  );
}

function ReadyLine({ r }: { r: Awaited<ReturnType<typeof rankForShift>> | undefined }) {
  if (!r) return null;
  const n = r.ranked.length;
  if (n > 0) return <span className="text-emerald-700">{n} carer{n === 1 ? "" : "s"} can be offered it</span>;
  return <span className="text-amber-800">nobody can be offered it: {whyNot(r.excluded).join("; ") || "no carers"}</span>;
}
