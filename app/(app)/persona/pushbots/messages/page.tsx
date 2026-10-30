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

  if (latest.length === 0) {
    return <EmptyState icon={MessageSquareText} title="No texts yet" description="Shift offers, carers' replies and Pushbots' answers appear here, one conversation per carer." />;
  }
  return (
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
  );
}
