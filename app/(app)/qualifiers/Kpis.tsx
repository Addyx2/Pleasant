import Link from "next/link";
import { addDays, differenceInCalendarDays, endOfDay, startOfDay, subDays } from "date-fns";
import { ArrowDownRight, ArrowUpRight, CalendarClock, ClipboardCheck, Minus, ShieldCheck, Users } from "lucide-react";

import { prisma } from "@/lib/db";
import { cn } from "@/lib/utils";
import { Card, IconTile } from "@/components/ui";

const FILLED = ["ASSIGNED", "IN_PROGRESS", "COMPLETED", "NO_SHOW"] as const;
const COUNTED = [...FILLED, "OPEN", "UNATTENDED"] as const;

type Tone = "good" | "bad" | "neutral";

function Trend({ delta, suffix = "", label, upIs = "good" }: { delta: number; suffix?: string; label: string; upIs?: "good" | "bad" | "neutral" }) {
  if (delta === 0) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-slate-500">
        <Minus className="h-3.5 w-3.5" /> No change {label}
      </span>
    );
  }
  const up = delta > 0;
  const tone: Tone = upIs === "neutral" ? "neutral" : (up ? upIs === "good" : upIs === "bad") ? "good" : "bad";
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-xs font-medium",
        tone === "good" ? "text-emerald-700" : tone === "bad" ? "text-red-700" : "text-slate-600",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {up ? "+" : "−"}
      {Math.abs(delta)}
      {suffix} {label}
    </span>
  );
}

function Kpi({
  label,
  value,
  icon,
  tone,
  children,
  href,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "brand" | "amber" | "blue" | "green" | "red";
  children: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500">
      <Card interactive className="h-full p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[13px] font-medium text-slate-500">{label}</p>
            <p className="tabular mt-1.5 font-display text-3xl font-bold tracking-tight text-slate-900">{value}</p>
            <div className="mt-1.5">{children}</div>
          </div>
          <IconTile icon={icon} tone={tone} />
        </div>
      </Card>
    </Link>
  );
}

const pct = (filled: number, total: number) => (total === 0 ? 100 : Math.round((filled / total) * 100));

/** Today's numbers, each with the context that says whether it's good or bad. */
export async function Kpis({ agencyId }: { agencyId: string }) {
  const now = new Date();
  const today = startOfDay(now);
  const lastWeekDay = subDays(today, 7);

  const [todayCount, lastWeekCount, next7Total, next7Filled, prev7Total, prev7Filled, pending, oldestPending, activeCarers, newCarers] =
    await Promise.all([
      prisma.shift.count({ where: { agencyId, startAt: { gte: today, lte: endOfDay(now) }, status: { not: "CANCELLED" } } }),
      prisma.shift.count({
        where: { agencyId, startAt: { gte: lastWeekDay, lte: endOfDay(lastWeekDay) }, status: { not: "CANCELLED" } },
      }),
      prisma.shift.count({ where: { agencyId, startAt: { gte: now, lt: addDays(now, 7) }, status: { in: [...COUNTED] } } }),
      prisma.shift.count({ where: { agencyId, startAt: { gte: now, lt: addDays(now, 7) }, status: { in: [...FILLED] } } }),
      prisma.shift.count({ where: { agencyId, startAt: { gte: subDays(now, 7), lt: now }, status: { in: [...COUNTED] } } }),
      prisma.shift.count({ where: { agencyId, startAt: { gte: subDays(now, 7), lt: now }, status: { in: [...FILLED] } } }),
      prisma.timesheet.count({ where: { agencyId, status: "PENDING" } }),
      prisma.timesheet.findFirst({ where: { agencyId, status: "PENDING" }, orderBy: { clockIn: "asc" }, select: { clockIn: true } }),
      prisma.staffProfile.count({ where: { agencyId, status: "ACTIVE" } }),
      prisma.staffProfile.count({ where: { agencyId, status: "ACTIVE", createdAt: { gte: subDays(now, 7) } } }),
    ]);

  const cover = pct(next7Filled, next7Total);
  const prevCover = pct(prev7Filled, prev7Total);
  const open = next7Total - next7Filled;
  const waitingDays = oldestPending ? Math.max(0, differenceInCalendarDays(now, oldestPending.clockIn)) : 0;

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Kpi label="Shifts today" value={String(todayCount)} icon={CalendarClock} tone="brand" href="/shifts/calendar">
        <Trend delta={todayCount - lastWeekCount} label="vs last week" upIs="neutral" />
      </Kpi>
      <Kpi
        label="Cover, next 7 days"
        value={`${cover}%`}
        icon={ShieldCheck}
        tone={open > 0 ? "amber" : "green"}
        href="/shifts?status=OPEN"
      >
        {open === 0 ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
            {next7Total === 0 ? "No shifts booked yet" : "Every shift has a carer"}
          </span>
        ) : (
          <span className="flex flex-wrap items-center gap-x-2 text-xs">
            <span className="font-medium text-amber-700">{open} open</span>
            <Trend delta={cover - prevCover} suffix=" pts" label="vs last 7 days" />
          </span>
        )}
      </Kpi>
      <Kpi
        label="Awaiting approval"
        value={String(pending)}
        icon={ClipboardCheck}
        tone={waitingDays > 2 ? "red" : "blue"}
        href="/timesheets"
      >
        {pending === 0 ? (
          <span className="text-xs font-medium text-emerald-700">All timesheets up to date</span>
        ) : (
          <span className={cn("text-xs font-medium", waitingDays > 2 ? "text-red-700" : "text-slate-500")}>
            Oldest waiting {waitingDays === 0 ? "since today" : `${waitingDays} day${waitingDays === 1 ? "" : "s"}`}
          </span>
        )}
      </Kpi>
      <Kpi label="Active carers" value={String(activeCarers)} icon={Users} tone="green" href="/staff">
        {newCarers === 0 ? (
          <span className="text-xs text-slate-500">No new carers this week</span>
        ) : (
          <Trend delta={newCarers} label="joined this week" />
        )}
      </Kpi>
    </div>
  );
}
