import Link from "next/link";
import { Info } from "lucide-react";

import { SCHEDULER_KEY, schedulerConfigured } from "@/lib/assist/automations";
import { describeSchedule, type Cadence } from "@/lib/assist/schedule";
import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";

import { AutomationsClient, type AutomationItem } from "./AutomationsClient";

export const metadata = { title: "Automations · Assist" };
export const dynamic = "force-dynamic";

const ukTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/London",
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AutomationsPage() {
  const user = await requireOps();
  const [automations, heartbeat] = await Promise.all([
    prisma.assistAutomation.findMany({
      where: user.role === "ADMIN" ? { agencyId: user.agencyId } : { userId: user.id },
      include: {
        user: { select: { firstName: true, lastName: true } },
        runs: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.systemHeartbeat.findUnique({ where: { key: SCHEDULER_KEY } }),
  ]);

  const toItem = (a: (typeof automations)[number], mine: boolean): AutomationItem => ({
    id: a.id,
    name: a.name,
    prompt: mine ? a.prompt : "",
    cadence: a.cadence as Cadence,
    weekday: a.weekday,
    time: a.time,
    emailResult: a.emailResult,
    enabled: a.enabled,
    schedule: describeSchedule(a.cadence as Cadence, a.weekday, a.time),
    nextRun: ukTime.format(a.nextRunAt),
    lastRun: a.lastRunAt ? ukTime.format(a.lastRunAt) : null,
    lastStatus: a.lastStatus,
    lastError: a.lastError,
    owner: mine ? undefined : `${a.user.firstName} ${a.user.lastName}`,
    runs: mine ? a.runs.map((r) => ({ id: r.id, at: ukTime.format(r.createdAt) })) : [],
  });

  const mine = automations.filter((a) => a.userId === user.id).map((a) => toItem(a, true));
  const team = automations.filter((a) => a.userId !== user.id).map((a) => toItem(a, false));
  const schedulerOn = schedulerConfigured();
  const recentTick = heartbeat && Date.now() - heartbeat.at.getTime() < 60 * 60_000;

  return (
    <div className="space-y-5">
      {!schedulerOn || !recentTick ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {!schedulerOn
              ? "Scheduled runs are off until a scheduler is connected."
              : `The scheduler hasn't checked in ${heartbeat ? `since ${ukTime.format(heartbeat.at)}` : "yet"}.`}{" "}
            You can still use <strong>Run now</strong>. See{" "}
            <Link href="/assist/connections" className="font-semibold underline">
              Connections
            </Link>{" "}
            to set it up.
          </p>
        </div>
      ) : null}
      <AutomationsClient mine={mine} team={team} role={user.role} />
    </div>
  );
}
