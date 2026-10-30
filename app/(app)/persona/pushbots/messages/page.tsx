import Link from "next/link";
import { MessageSquareText } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge, Card, EmptyState } from "@/components/ui";

export const metadata = { title: "Pushbots texts" };
export const dynamic = "force-dynamic";

const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Every carer the agency has texted with, latest conversation first. */
export default async function MessagesPage() {
  const user = await requireOps();
  const latest = await prisma.smsMessage.findMany({
    where: { agencyId: user.agencyId, staffId: { not: null } },
    distinct: ["staffId"],
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const staff = await prisma.staffProfile.findMany({
    where: { id: { in: latest.map((m) => m.staffId!) }, agencyId: user.agencyId },
    select: { id: true, firstName: true, lastName: true, smsOptOutAt: true },
  });
  const flagged = new Set(
    (
      await prisma.agentLog.findMany({
        where: { agencyId: user.agencyId, agentName: "PUSHBOTS", action: "CARER_MESSAGE", createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } },
        select: { details: true },
      })
    ).flatMap((l) => {
      try {
        return [JSON.parse(l.details ?? "{}").staffId as string];
      } catch {
        return [];
      }
    }),
  );

  const [officeLatest, jobs] = await Promise.all([
    prisma.smsMessage.findMany({ where: { agencyId: user.agencyId, userId: { not: null } }, distinct: ["userId"], orderBy: { createdAt: "desc" }, take: 20 }),
    prisma.pushbotAction.findMany({ where: { agencyId: user.agencyId }, include: { user: { select: { firstName: true, lastName: true } } }, orderBy: { createdAt: "desc" }, take: 15 }),
  ]);
  const officeUsers = await prisma.user.findMany({ where: { id: { in: officeLatest.map((m) => m.userId!) }, agencyId: user.agencyId }, select: { id: true, firstName: true, lastName: true } });
  const JOB: Record<string, { label: string; tone: "green" | "amber" | "red" | "slate" }> = {
    pending: { label: "Waiting for YES", tone: "amber" },
    done: { label: "Done", tone: "green" },
    failed: { label: "Failed", tone: "red" },
    cancelled: { label: "Said no", tone: "slate" },
    expired: { label: "Expired", tone: "slate" },
  };

  const officeCard =
    officeLatest.length || jobs.length ? (
      <Card className="p-4">
        <h2 className="text-sm font-semibold text-slate-900">From the office</h2>
        {officeLatest.length ? (
          <ul className="mt-2 divide-y divide-slate-100">
            {officeLatest.map((m) => {
              const u = officeUsers.find((x) => x.id === m.userId);
              return u ? (
                <li key={m.id}>
                  <Link href={`/persona/pushbots/messages/office/${u.id}`} className="flex items-start justify-between gap-4 py-2 hover:bg-slate-50">
                    <span className="min-w-0">
                      <span className="text-sm font-medium text-slate-900">{u.firstName} {u.lastName}</span>
                      <span className="block truncate text-sm text-slate-500">{m.direction === "IN" ? "" : "Pushbot: "}{m.body}</span>
                    </span>
                    <span className="shrink-0 text-xs text-slate-400">{fmt.format(m.createdAt)}</span>
                  </Link>
                </li>
              ) : null;
            })}
          </ul>
        ) : null}
        {jobs.length ? (
          <>
            <p className="mt-3 text-xs font-semibold uppercase tracking-wider text-slate-400">Jobs asked for by text</p>
            <ul className="mt-1 divide-y divide-slate-100">
              {jobs.map((j) => (
                <li key={j.id} className="flex flex-wrap items-center justify-between gap-2 py-2 text-sm">
                  <span className="min-w-0 flex-1">
                    <span className="text-slate-800">{j.user.firstName}: {j.summary}</span>
                    {j.result ? <span className="block text-xs text-slate-500">{j.result}</span> : null}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{fmt.format(j.createdAt)}</span>
                    <Badge tone={JOB[j.status]?.tone ?? "slate"}>{JOB[j.status]?.label ?? j.status}</Badge>
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </Card>
    ) : null;

  if (latest.length === 0) {
    return (
      <div className="space-y-4">
        {officeCard}
        <EmptyState icon={MessageSquareText} title="No texts with carers yet" description="Shift offers, carers' replies and the Pushbot's answers appear here, one conversation per carer." />
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {officeCard}
      <h2 className="text-sm font-semibold text-slate-900">Carers</h2>
    <Card className="divide-y divide-slate-100">
      {latest.map((m) => {
        const s = staff.find((x) => x.id === m.staffId);
        if (!s) return null;
        return (
          <Link key={m.id} href={`/persona/pushbots/messages/${s.id}`} className="flex items-start justify-between gap-4 px-4 py-3 hover:bg-slate-50">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                {s.firstName} {s.lastName}
                {flagged.has(s.id) ? <Badge tone="amber">For the office</Badge> : null}
                {s.smsOptOutAt ? <Badge tone="slate">Texted STOP</Badge> : null}
              </p>
              <p className="truncate text-sm text-slate-500">
                {m.direction === "IN" ? "" : "You: "}
                {m.body}
              </p>
            </div>
            <span className="shrink-0 text-xs text-slate-400">{fmt.format(m.createdAt)}</span>
          </Link>
        );
      })}
    </Card>
    </div>
  );
}
