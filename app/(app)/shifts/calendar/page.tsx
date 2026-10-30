import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, List, Plus } from "lucide-react";
import type { Prisma, ShiftStatus } from "@prisma/client";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Card, PageHeader } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";

export const metadata = { title: "Calendar | Shifts" };
export const dynamic = "force-dynamic";

const FILTERS = ["ALL", "OPEN", "ASSIGNED", "COMPLETED"] as const;
const VIEWS = ["week", "day", "month"] as const;
const GROUPS = ["carer", "client"] as const;

const shiftInclude = {
  client: true,
  staff: true,
  site: true,
  rotaTemplate: true,
} satisfies Prisma.ShiftInclude;

type CalendarShift = Prisma.ShiftGetPayload<{ include: typeof shiftInclude }>;

function startOfWeek(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 Sun
  const diff = (day === 0 ? -6 : 1) - day; // Monday first
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function startOfMonth(d: Date) {
  const date = new Date(d);
  date.setHours(0, 0, 0, 0);
  date.setDate(1);
  return date;
}

function addDays(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(date.getDate() + n);
  return date;
}

function addMonths(d: Date, n: number) {
  const date = new Date(d);
  date.setDate(1);
  date.setMonth(date.getMonth() + n);
  return date;
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function isOvernight(startAt: Date, endAt: Date) {
  return endAt.getTime() < startAt.getTime() || endAt.getDate() !== startAt.getDate();
}

function dayKey(d: Date) {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Shifts that touch this day: a shift running past midnight shows on both days. */
function shiftsOnDay(shifts: CalendarShift[], day: Date) {
  return shifts.filter(
    (sh) => sameDay(sh.startAt, day) || (isOvernight(sh.startAt, sh.endAt) && sameDay(sh.endAt, day)),
  );
}

function clientLabel(shift: CalendarShift) {
  const client = shift.client;
  if (!client) return shift.site?.name ?? "—";
  return client.name ?? ([client.firstName, client.lastName].filter(Boolean).join(" ") || "Client");
}

function statusColor(status: ShiftStatus) {
  if (status === "OPEN" || status === "UNATTENDED") return "border-amber-300 bg-amber-50 text-amber-900";
  if (status === "ASSIGNED" || status === "IN_PROGRESS") return "border-emerald-300 bg-emerald-50 text-emerald-900";
  if (status === "COMPLETED") return "border-slate-300 bg-slate-50 text-slate-700";
  return "border-slate-200 bg-white text-slate-800";
}

/** Two shifts for the same carer that share time: surfaced on the card (R7). */
function overlappingIds(shifts: CalendarShift[]) {
  const clashing = new Set<string>();
  const byStaff = new Map<string, CalendarShift[]>();
  for (const shift of shifts) {
    if (!shift.staffId) continue;
    const list = byStaff.get(shift.staffId) ?? [];
    list.push(shift);
    byStaff.set(shift.staffId, list);
  }
  for (const list of byStaff.values()) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (a.startAt < b.endAt && b.startAt < a.endAt) {
          clashing.add(a.id);
          clashing.add(b.id);
        }
      }
    }
  }
  return clashing;
}

export default async function ShiftsCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; view?: string; group?: string; date?: string }>;
}) {
  const user = await requireAdmin();
  const { status, view = "week", group = "carer", date } = await searchParams;

  const activeFilter: (typeof FILTERS)[number] = FILTERS.includes(status as never)
    ? (status as (typeof FILTERS)[number])
    : "ALL";
  const activeView: (typeof VIEWS)[number] = VIEWS.includes(view as never)
    ? (view as (typeof VIEWS)[number])
    : "week";
  const activeGroup: (typeof GROUPS)[number] = GROUPS.includes(group as never)
    ? (group as (typeof GROUPS)[number])
    : "carer";

  const baseDate = date ? new Date(`${date}T00:00:00`) : new Date();
  const weekStart = startOfWeek(baseDate);
  const monthStart = startOfMonth(baseDate);
  const gridStart = startOfWeek(monthStart);
  const rangeStart = activeView === "month" ? gridStart : activeView === "day" ? addDays(baseDate, -1) : weekStart;
  const rangeEnd =
    activeView === "month" ? addDays(gridStart, 42) : activeView === "day" ? addDays(baseDate, 2) : addDays(weekStart, 7);

  const [shifts, activeStaff, clients] = await Promise.all([
    prisma.shift.findMany({
      where: {
        agencyId: user.agencyId,
        ...(activeFilter !== "ALL" ? { status: activeFilter as ShiftStatus } : {}),
        startAt: { gte: rangeStart, lt: rangeEnd },
      },
      include: shiftInclude,
      orderBy: { startAt: "asc" },
      take: 1000,
    }),
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.client.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: [{ name: "asc" }],
      select: { id: true, name: true, firstName: true, lastName: true },
    }),
  ]);

  const clashing = overlappingIds(shifts);
  const openShifts = shifts.filter((s) => s.status === "OPEN" || s.status === "UNATTENDED");
  const unassigned = shifts.filter((s) => !s.staffId && s.status !== "COMPLETED" && s.status !== "CANCELLED");

  const days =
    activeView === "month"
      ? Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
      : activeView === "day"
        ? [baseDate]
        : Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  const dateParam = (d: Date) => d.toISOString().slice(0, 10);
  const link = (overrides: Partial<{ status: string; view: string; group: string; date: string }>) => {
    const params = new URLSearchParams({
      view: activeView,
      group: activeGroup,
      date: dateParam(baseDate),
      ...(activeFilter !== "ALL" ? { status: activeFilter } : {}),
      ...Object.fromEntries(Object.entries(overrides).filter(([, v]) => v != null)),
    } as Record<string, string>);
    return `/shifts/calendar?${params.toString()}`;
  };

  const step = activeView === "month" ? 30 : activeView === "day" ? 1 : 7;
  const previous = activeView === "month" ? addMonths(baseDate, -1) : addDays(baseDate, -step);
  const next = activeView === "month" ? addMonths(baseDate, 1) : addDays(baseDate, step);
  const heading =
    activeView === "month"
      ? monthStart.toLocaleDateString("en-GB", { month: "long", year: "numeric" })
      : activeView === "day"
        ? baseDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
        : `${formatDate(weekStart)} – ${formatDate(addDays(weekStart, 6))}`;

  const rows =
    activeGroup === "carer"
      ? activeStaff.map((s) => ({
          id: s.id,
          label: `${s.firstName} ${s.lastName}`,
          shifts: shifts.filter((sh) => sh.staffId === s.id),
          unassigned: false,
        }))
      : clients.map((c) => ({
          id: c.id,
          label: c.name ?? ([c.firstName, c.lastName].filter(Boolean).join(" ") || "Client"),
          shifts: shifts.filter((sh) => sh.clientId === c.id),
          unassigned: false,
        }));

  if (activeGroup === "carer" && unassigned.length > 0) {
    rows.push({ id: "__unassigned", label: "Unassigned", shifts: unassigned, unassigned: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar"
        description="The same shifts on a day, week or month grid. Group by carer or client."
        action={
          <Link
            href="/shifts/new"
            className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-btn transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> New shift
          </Link>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <Link
              key={filter}
              href={filter === "ALL" ? link({ status: undefined }) : link({ status: filter })}
              className={
                filter === activeFilter
                  ? "rounded-full bg-brand-600 px-3 py-1 text-xs font-semibold text-white"
                  : "rounded-full border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {filter === "ALL" ? "All" : filter.charAt(0) + filter.slice(1).toLowerCase()}
            </Link>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {VIEWS.map((v) => (
              <Link
                key={v}
                href={link({ view: v })}
                className={
                  v === activeView
                    ? "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-900"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                }
              >
                {v === "week" ? "Week" : v === "day" ? "Day" : "Month"}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            {GROUPS.map((g) => (
              <Link
                key={g}
                href={link({ group: g })}
                className={
                  g === activeGroup
                    ? "rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-900"
                    : "rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                }
              >
                {g === "carer" ? "By Carer" : "By Client"}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
            <Link
              href={activeFilter === "ALL" ? "/shifts" : `/shifts?status=${activeFilter}`}
              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <List className="h-3.5 w-3.5" /> List
            </Link>
            <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-900">
              <CalendarDays className="h-3.5 w-3.5" /> Calendar
            </span>
          </div>
        </div>
      </div>

      <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
        <div className="flex items-center gap-2">
          <Link
            href={link({ date: dateParam(previous) })}
            aria-label={activeView === "month" ? "Previous month" : activeView === "day" ? "Previous day" : "Previous week"}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link href={link({ date: dateParam(new Date()) })} className="text-xs font-medium text-brand-700 hover:underline">
            Today
          </Link>
          <Link
            href={link({ date: dateParam(next) })}
            aria-label={activeView === "month" ? "Next month" : activeView === "day" ? "Next day" : "Next week"}
            className="rounded-md border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <p className="ml-2 text-sm font-medium text-slate-900">{heading}</p>
        </div>
        <p className="text-xs text-slate-600">
          Open shifts: <span className="font-semibold text-amber-700">{openShifts.length}</span> · Unassigned:{" "}
          <span className="font-semibold text-amber-700">{unassigned.length}</span>
        </p>
      </Card>

      {activeView === "month" ? (
        <Card className="overflow-x-auto">
          <div className="min-w-[900px]">
            <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
              {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
                <div key={label} className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {label}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((day) => {
                const dayShifts = shiftsOnDay(shifts, day);
                const isCurrentMonth = day.getMonth() === monthStart.getMonth();
                const isToday = sameDay(day, new Date());
                return (
                  <div
                    key={dayKey(day)}
                    className={`min-h-[110px] border-b border-l border-slate-100 p-2 ${
                      isCurrentMonth ? "bg-white" : "bg-slate-50/60"
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between">
                      <span
                        className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-xs ${
                          isToday ? "bg-brand-600 font-semibold text-white" : "text-slate-500"
                        }`}
                      >
                        {day.getDate()}
                      </span>
                      {dayShifts.length > 0 ? <span className="text-[11px] text-slate-400">{dayShifts.length}</span> : null}
                    </div>
                    <div className="space-y-1">
                      {dayShifts.slice(0, 3).map((sh) => (
                        <Link
                          key={sh.id}
                          href={sh.status === "OPEN" || sh.status === "UNATTENDED" ? "/dispatch?tab=to-cover" : `/shifts/${sh.id}`}
                          className={`block truncate rounded border px-1.5 py-0.5 text-[11px] ${statusColor(sh.status)}`}
                        >
                          {formatTime(sh.startAt)} {sh.title}
                        </Link>
                      ))}
                      {dayShifts.length > 3 ? (
                        <p className="px-1 text-[11px] text-slate-500">+{dayShifts.length - 3} more</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      ) : activeView === "day" ? (
        <Card className="p-4">
          <div className="space-y-2">
            {shiftsOnDay(shifts, baseDate).length === 0 ? (
              <p className="text-sm text-slate-500">No shifts this day.</p>
            ) : null}
            {shiftsOnDay(shifts, baseDate).map((sh) => (
              <Link
                key={sh.id}
                href={sh.status === "OPEN" || sh.status === "UNATTENDED" ? "/dispatch?tab=to-cover" : `/shifts/${sh.id}`}
                className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm ${statusColor(sh.status)}`}
              >
                <div>
                  <p className="font-semibold">
                    {formatTime(sh.startAt)} – {formatTime(sh.endAt)} · {sh.title}
                  </p>
                  <p className="text-xs opacity-80">
                    {clientLabel(sh)} ·{" "}
                    {sh.staff ? `${sh.staff.firstName} ${sh.staff.lastName}` : "Unassigned"}
                  </p>
                </div>
                <span className="text-xs font-semibold uppercase">{sh.status.replace("_", " ")}</span>
              </Link>
            ))}
          </div>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <div className="min-w-[1100px]">
            <div className="grid grid-cols-[220px_repeat(7,minmax(0,1fr))] border-b border-slate-200">
              <div className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {activeGroup === "carer" ? "Carer" : "Client"}
              </div>
              {days.map((d) => (
                <div key={dayKey(d)} className="border-l border-slate-200 px-3 py-2">
                  <p className="text-xs font-semibold text-slate-900">
                    {d.toLocaleDateString("en-GB", { weekday: "short" })}
                  </p>
                  <p className="text-xs text-slate-500">{formatDate(d)}</p>
                </div>
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {rows.map((row) => (
                <div
                  key={row.id}
                  className={`grid grid-cols-[220px_repeat(7,minmax(0,1fr))] ${row.unassigned ? "bg-amber-50/40" : ""}`}
                >
                  <div className="flex items-center px-4 py-3">
                    <p className={`text-sm font-medium ${row.unassigned ? "text-amber-900" : "text-slate-900"}`}>
                      {row.label}
                    </p>
                  </div>
                  {days.map((d) => (
                    <div key={dayKey(d)} className="min-h-[90px] border-l border-slate-200 p-2">
                      <div className="space-y-1.5">
                        {shiftsOnDay(row.shifts, d).map((sh) => (
                          <Link
                            key={sh.id}
                            href={sh.status === "OPEN" || sh.status === "UNATTENDED" ? "/dispatch?tab=to-cover" : `/shifts/${sh.id}`}
                            className={`block rounded-lg border px-2 py-1.5 text-xs shadow-sm transition hover:shadow ${statusColor(sh.status)}`}
                          >
                            <p className="font-semibold">
                              {formatTime(sh.startAt)} – {formatTime(sh.endAt)}
                            </p>
                            <p className="truncate">{sh.title}</p>
                            <p className="truncate text-[11px] opacity-80">{clientLabel(sh)}</p>
                            <p className="flex flex-wrap items-center gap-1 text-[11px] font-medium uppercase tracking-wide">
                              {sh.status.replace("_", " ")}
                              {clashing.has(sh.id) ? (
                                <span className="rounded bg-red-100 px-1 text-[10px] font-semibold normal-case text-red-700">
                                  Overlap
                                </span>
                              ) : null}
                            </p>
                          </Link>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
