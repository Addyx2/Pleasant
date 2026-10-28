import Link from "next/link";
import { addDays, format } from "date-fns";

import { requireUser } from "@/lib/auth";
import { clashingRule, ukDate } from "@/lib/availability";
import { expectedPay } from "@/lib/carer-pay";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { formatCurrency, formatTime } from "@/lib/utils";

import { Empty, PageTitle, Panel, Pill } from "../ui";
import { requestShiftAction } from "./actions";

export const metadata = { title: "Pool" };
export const dynamic = "force-dynamic";

const BANNERS: Record<string, { tone: "good" | "bad"; text: string }> = {
  requested: { tone: "good", text: "Requested. Your agency will confirm." },
  overlap: { tone: "bad", text: "You already have a shift that clashes with this one." },
  gone: { tone: "bad", text: "That shift has just been filled." },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "today", label: "Today" },
  { key: "tomorrow", label: "Tomorrow" },
  { key: "weekend", label: "Weekend" },
  { key: "nights", label: "Nights" },
  { key: "sleepins", label: "Sleep-ins" },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

/** Open shifts the carer can ask for, with what they'd earn. */
export default async function OpenShiftsPage({ searchParams }: { searchParams: Promise<{ result?: string; show?: string }> }) {
  const user = await requireUser();
  const profile = user.staff;
  if (!profile) return <Empty>No carer profile linked yet.</Empty>;
  const { result, show } = await searchParams;
  const banner = result && result in BANNERS ? BANNERS[result] : null;
  const filter: FilterKey = FILTERS.some((f) => f.key === show) ? (show as FilterKey) : "all";

  const now = new Date();
  const [shifts, requests, rules] = await Promise.all([
    prisma.shift.findMany({
      where: { agencyId: user.agencyId, staffId: null, status: "OPEN", startAt: { gte: now, lte: addDays(now, 30) } },
      include: { client: true, site: true },
      orderBy: { startAt: "asc" },
      take: 60,
    }),
    prisma.shiftRequest.findMany({ where: { staffId: profile.id, shift: { status: "OPEN", staffId: null } }, select: { shiftId: true, status: true } }),
    prisma.staffUnavailability.findMany({ where: { staffId: profile.id, endsOn: { gte: new Date(`${ukDate(now)}T00:00:00Z`) } } }),
  ]);
  const requestBy = new Map(requests.map((r) => [r.shiftId, r.status]));

  const today = ukDate(now);
  const tomorrow = ukDate(addDays(now, 1));
  const isNight = (s: { startAt: Date }) => { const h = Number(format(s.startAt, "H")); return h >= 18 || h < 4; };
  const isWeekend = (s: { startAt: Date }) => ["Sat", "Sun"].includes(format(s.startAt, "EEE"));
  const shown = shifts.filter((s) => {
    switch (filter) {
      case "today": return ukDate(s.startAt) === today;
      case "tomorrow": return ukDate(s.startAt) === tomorrow;
      case "weekend": return isWeekend(s);
      case "nights": return isNight(s) && !s.isSleepIn;
      case "sleepins": return s.isSleepIn;
      default: return true;
    }
  });

  return (
    <div className="space-y-5 pb-8">
      <PageTitle title="Pool" subtitle={`Open shifts at ${user.agency.name}, for the next 30 days.`} />

      {banner ? (
        <p role="status" className={`rounded-2xl px-4 py-3 text-sm font-medium ${banner.tone === "good" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>{banner.text}</p>
      ) : null}

      <nav aria-label="Filter shifts" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={f.key === "all" ? "/workforce/open-shifts" : `/workforce/open-shifts?show=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium ${filter === f.key ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 bg-white text-slate-600"}`}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <Empty>{shifts.length === 0 ? "No open shifts right now. New ones appear here as soon as they're posted." : "No open shifts match. Try another filter."}</Empty>
      ) : (
        <ul className="space-y-3">
          {shown.map((s) => {
            const pay = expectedPay(profile, s);
            const status = requestBy.get(s.id);
            const offDay = clashingRule(rules, s.startAt, s.endAt);
            return (
              <li key={s.id}>
                <Panel className="space-y-3 p-0">
                  <div className="space-y-2 p-4 pb-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-mono text-[11px] uppercase text-slate-500">{ukDate(s.startAt) === today ? "Today" : ukDate(s.startAt) === tomorrow ? "Tomorrow" : format(s.startAt, "EEE d MMM")} · {formatTime(s.startAt)}–{formatTime(s.endAt)}</p>
                        <p className="mt-0.5 font-semibold text-slate-900">{s.client ? clientName(s.client) : (s.site?.name ?? "Location to be confirmed")}</p>
                        <p className="text-sm text-slate-600">{[s.site && s.client ? s.site.name : null, s.role].filter(Boolean).join(" · ")}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        {s.isSleepIn ? (
                          <><p className="font-mono text-lg font-bold text-slate-900">{formatCurrency(pay.total ?? 0)}</p><p className="text-[11px] text-slate-500">sleep-in</p></>
                        ) : pay.rate != null ? (
                          <><p className="font-mono text-lg font-bold text-slate-900">{formatCurrency(pay.rate)}<span className="text-xs font-medium text-slate-500">/h</span></p><p className="text-[11px] text-slate-500">≈ {formatCurrency(pay.total ?? 0)} for {pay.hours.toFixed(1)} h</p></>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {isNight(s) && !s.isSleepIn ? <Pill>Night</Pill> : null}
                      {isWeekend(s) ? <Pill>Weekend</Pill> : null}
                      {s.isSleepIn ? <Pill>Sleep-in</Pill> : null}
                      {offDay ? <Pill tone="amber">You said you can&apos;t work this day</Pill> : null}
                    </div>
                  </div>
                  <div className="border-t border-slate-100 p-3">
                    {status === "PENDING" ? (
                      <p className="rounded-xl bg-amber-50 py-2.5 text-center text-sm font-medium text-amber-800">Requested · waiting for {user.agency.name}</p>
                    ) : (
                      <form action={requestShiftAction}>
                        <input type="hidden" name="shiftId" value={s.id} />
                        <input type="hidden" name="show" value={filter} />
                        {status === "REJECTED" ? <p className="mb-2 text-center text-xs text-slate-500">Your last request wasn&apos;t accepted. You can ask again.</p> : null}
                        <button type="submit" className="w-full rounded-xl bg-brand-600 py-3 text-sm font-semibold text-white active:scale-[0.99]">Request this shift</button>
                      </form>
                    )}
                  </div>
                </Panel>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
