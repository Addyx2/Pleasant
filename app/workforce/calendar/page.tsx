import Link from "next/link";
import { addMonths, endOfMonth, format, startOfMonth } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { clashingRule, ukDate, WEEKDAY_NAMES } from "@/lib/availability";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";

import { Empty, PageTitle, Panel, Pill, Section } from "../ui";
import { removeUnavailabilityAction } from "./actions";
import { AvailabilityForm } from "./AvailabilityForm";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

/** The carer's month: shifts, requests waiting on the agency, and times they can't work. */
export default async function WorkforceCalendarPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const user = await requireUser();
  const profile = user.staff;
  if (!profile) return <Empty>No carer profile linked yet.</Empty>;

  const { m } = await searchParams;
  const today = ukDate(new Date());
  const month = /^\d{4}-\d{2}$/.test(m ?? "") ? new Date(`${m}-01T12:00:00Z`) : new Date(`${today.slice(0, 7)}-01T12:00:00Z`);
  const from = startOfMonth(month);
  const to = endOfMonth(month);

  const [shifts, requests, rules] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId: user.agencyId, staffId: profile.id, startAt: { gte: from, lte: to }, status: { notIn: ["CANCELLED"] } },
      include: { client: true, site: true },
      orderBy: { startAt: "asc" },
    }),
    prisma.shiftRequest.findMany({
      where: { staffId: profile.id, status: "PENDING", shift: { startAt: { gte: from, lte: to } } },
      include: { shift: { include: { client: true, site: true } } },
    }),
    prisma.staffUnavailability.findMany({ where: { staffId: profile.id, agencyId: user.agencyId, endsOn: { gte: new Date(`${today}T00:00:00Z`) } }, orderBy: { startsOn: "asc" } }),
  ]);

  const days = Array.from({ length: to.getDate() }, (_, i) => new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), i + 1, 12)));
  const lead = (days[0].getUTCDay() + 6) % 7;
  const onDay = (d: Date) => ukDate(d);
  const dayShifts = (d: Date) => shifts.filter((s) => ukDate(s.startAt) === onDay(d));
  const dayRequests = (d: Date) => requests.filter((r) => ukDate(r.shift.startAt) === onDay(d));
  const blocked = (d: Date) => Boolean(clashingRule(rules, new Date(d.getTime() - 3_600_000 * 11), new Date(d.getTime() + 3_600_000 * 11)));
  const upcoming = shifts.filter((s) => ukDate(s.startAt) >= today);
  const prev = format(addMonths(month, -1), "yyyy-MM");
  const next = format(addMonths(month, 1), "yyyy-MM");

  return (
    <div className="space-y-6 pb-8">
      <PageTitle title="Calendar" subtitle="Your shifts, and the times you can't work." />

      <Panel>
        <div className="mb-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-900">{format(month, "MMMM yyyy")}</span>
          <div className="flex items-center gap-1 text-slate-500">
            <Link href={`/workforce/calendar?m=${prev}`} aria-label="Previous month" className="rounded-lg p-1.5 hover:bg-slate-100"><ChevronLeft className="h-4 w-4" /></Link>
            <Link href={`/workforce/calendar?m=${next}`} aria-label="Next month" className="rounded-lg p-1.5 hover:bg-slate-100"><ChevronRight className="h-4 w-4" /></Link>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="pb-1 font-mono text-[10px] font-semibold text-slate-400">{d}</span>)}
          {Array.from({ length: lead }, (_, i) => <span key={`lead${i}`} />)}
          {days.map((d) => {
            const has = dayShifts(d).length > 0;
            const pending = dayRequests(d).length > 0;
            const off = blocked(d);
            const isToday = onDay(d) === today;
            return (
              <span key={d.toISOString()} className={`flex flex-col items-center rounded-lg py-1.5 text-xs ${isToday ? "bg-slate-900 font-bold text-white" : off ? "bg-slate-100 text-slate-400" : "text-slate-700"}`}>
                {d.getUTCDate()}
                <span className="mt-0.5 flex h-1.5 gap-0.5">
                  {has ? <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> : null}
                  {pending ? <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> : null}
                </span>
              </span>
            );
          })}
        </div>
        <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Booked</span>
          <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />Requested</span>
          <span className="flex items-center gap-1"><span className="h-2 w-3 rounded-sm bg-slate-200" />Can&apos;t work</span>
        </div>
      </Panel>

      <Section label="This month's shifts">
        {upcoming.length === 0 && requests.length === 0 ? (
          <Empty>No more shifts this month. Open shifts are under <Link href="/workforce/open-shifts" className="font-semibold text-brand-700">Pool</Link>.</Empty>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <li key={s.id}>
                <Panel className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase text-slate-500">{format(s.startAt, "EEE d MMM")} · {format(s.startAt, "HH:mm")}–{format(s.endAt, "HH:mm")}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-600">{s.client ? clientName(s.client) : (s.site?.name ?? "Location to be confirmed")}</p>
                  </div>
                  <Pill tone="green">Booked</Pill>
                </Panel>
              </li>
            ))}
            {requests.map((r) => (
              <li key={r.id}>
                <Panel className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] uppercase text-slate-500">{format(r.shift.startAt, "EEE d MMM")} · {format(r.shift.startAt, "HH:mm")}–{format(r.shift.endAt, "HH:mm")}</p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900">{r.shift.title}</p>
                    <p className="text-xs text-slate-600">{r.shift.client ? clientName(r.shift.client) : (r.shift.site?.name ?? "Location to be confirmed")}</p>
                  </div>
                  <Pill tone="amber">Requested</Pill>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section label="When you can't work">
        <p className="text-xs text-slate-500">{user.agency.name} can&apos;t book you or offer you shifts at these times.</p>
        {rules.length > 0 ? (
          <ul className="space-y-2">
            {rules.map((r) => (
              <li key={r.id}>
                <Panel className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">
                      {r.weekday ? `Every ${WEEKDAY_NAMES[r.weekday - 1]}` : r.startsOn.getTime() === r.endsOn.getTime() ? format(r.startsOn, "EEE d MMM") : `${format(r.startsOn, "d MMM")} – ${format(r.endsOn, "d MMM yyyy")}`}
                    </p>
                    <p className="text-xs text-slate-500">{[r.reason, r.weekday ? `until ${format(r.endsOn, "d MMM yyyy")}` : null].filter(Boolean).join(" · ") || "No reason given"}</p>
                  </div>
                  <form action={removeUnavailabilityAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="text-xs font-semibold text-slate-500 hover:text-red-700">Remove</button>
                  </form>
                </Panel>
              </li>
            ))}
          </ul>
        ) : null}
        <AvailabilityForm today={today} />
      </Section>
    </div>
  );
}
