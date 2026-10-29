import Link from "next/link";
import { addDays, format } from "date-fns";
import { Clock, Coffee, MapPin, Navigation, StickyNote } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { carerRate } from "@/lib/carer-pay";
import { currentShift, needsSignOff, placeOf } from "@/lib/carer/screens";
import { prisma } from "@/lib/db";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { nextCutoff, payDayForCutoff, weekdayName } from "@/lib/week";
import { SignOffForm } from "@/components/SignOffForm";
import { respondToOfferAction } from "@/app/workforce/offers/actions";
import {
  clockInFormAction,
  clockOutAction,
  endBreakAction,
  saveCandidateSignatureAction,
  saveClientAuthAction,
  startBreakAction,
} from "@/app/(app)/timesheets/actions";

import { ClockInButton, Elapsed } from "./ShiftControls";
import { Empty, PageTitle, Panel, Pill, Section } from "./ui";

export const dynamic = "force-dynamic";

type ShiftRow = Awaited<ReturnType<typeof loadShifts>>[number];

function loadShifts(agencyId: string, staffId: string, from: Date, to: Date) {
  return prisma.shift.findMany({
    where: { agencyId, staffId, startAt: { gte: from, lt: to }, status: { notIn: ["CANCELLED"] } },
    include: { client: true, site: true, timesheet: true },
    orderBy: { startAt: "asc" },
  });
}

export default async function WorkforceHomePage() {
  const user = await requireUser();
  const profile = user.staff;
  if (!profile) return <Empty>Your login isn&apos;t linked to a carer record yet. Ask your agency manager to link it.</Empty>;

  const now = new Date();
  const [shifts, offers] = await Promise.all([
    loadShifts(user.agencyId, profile.id, addDays(now, -2), addDays(now, 8)),
    prisma.shiftOffer.findMany({
      where: { agencyId: user.agencyId, staffId: profile.id, status: "OFFERED", shift: { startAt: { gte: now } } },
      include: { shift: { include: { client: true, site: true } } },
      orderBy: { offeredAt: "desc" },
      take: 10,
    }),
  ]);
  const current = currentShift(shifts, now);
  const upcoming = shifts.filter((s) => s.id !== current?.id && s.endAt > now && !s.timesheet);
  const toSign = shifts.filter((s) => s.id !== current?.id && needsSignOff(s));

  const schedule = { cutoffWeekday: user.agency.cutoffWeekday, cutoffTime: user.agency.cutoffTime, payWeekday: user.agency.payWeekday };
  const cutoff = nextCutoff(schedule);
  const payDay = payDayForCutoff(schedule, cutoff);

  return (
    <div className="space-y-6 pb-8">
      <PageTitle title={`Hello, ${profile.firstName}`} subtitle={format(now, "EEEE d MMMM")} />

      {current ? <ShiftHero shift={current} profile={profile} now={now} /> : (
        <Empty>
          No shift right now.{" "}
          <Link href="/workforce/open-shifts" className="font-semibold text-brand-700">Find open shifts in Pool</Link>
        </Empty>
      )}

      {offers.length > 0 ? (
        <Section label={`Offered to you · ${offers.length}`}>
          <ul className="space-y-2">
            {offers.map((offer) => (
              <li key={offer.id}>
                <Panel className="space-y-3 border-brand-200 bg-brand-50/60">
                  <div>
                    <p className="font-mono text-[11px] uppercase text-brand-700">{format(offer.shift.startAt, "EEE d MMM")} · {formatTime(offer.shift.startAt)}–{formatTime(offer.shift.endAt)}</p>
                    <p className="mt-0.5 font-semibold text-slate-900">{offer.shift.title}</p>
                    <p className="text-sm text-slate-600">{placeOf(offer.shift)}</p>
                  </div>
                  <div className="flex gap-2">
                    <form action={respondToOfferAction} className="flex-1">
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="accept" value="1" />
                      <button type="submit" className="w-full rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white active:scale-[0.99]">Accept</button>
                    </form>
                    <form action={respondToOfferAction}>
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="accept" value="0" />
                      <button type="submit" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600">Decline</button>
                    </form>
                  </div>
                </Panel>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      {toSign.length > 0 ? (
        <Section label={`To sign off · ${toSign.length}`} action={<Link href="/workforce/timesheets" className="text-xs font-semibold text-brand-700">Timesheets</Link>}>
          <ul className="space-y-2">
            {toSign.map((s) => (
              <li key={s.id}>
                <Link href="/workforce/timesheets">
                  <Panel className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase text-slate-500">{format(s.startAt, "EEE d MMM")} · {formatTime(s.startAt)}–{formatTime(s.endAt)}</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{placeOf(s)}</p>
                    </div>
                    <Pill tone="amber">{s.timesheet?.candidateSignedAt ? "Needs their signature" : "Needs your signature"}</Pill>
                  </Panel>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section label="Next 7 days" action={<Link href="/workforce/calendar" className="text-xs font-semibold text-brand-700">Calendar</Link>}>
        {upcoming.length === 0 ? <Empty>Nothing else booked this week.</Empty> : (
          <ul className="space-y-2">
            {upcoming.map((s) => {
              const rate = s.isSleepIn ? null : carerRate(profile, s.startAt, s.endAt);
              return (
                <li key={s.id}>
                  <Panel className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-mono text-[11px] uppercase text-slate-500">{format(s.startAt, "EEE d MMM")} · {formatTime(s.startAt)}–{formatTime(s.endAt)}</p>
                      <p className="mt-0.5 font-semibold text-slate-900">{placeOf(s)}</p>
                      <p className="text-sm text-slate-600">{[s.site && s.client ? s.site.name : null, s.role].filter(Boolean).join(" · ")}</p>
                    </div>
                    <span className="shrink-0 text-right font-mono text-sm font-semibold text-slate-900">
                      {s.isSleepIn ? `${formatCurrency(Number(s.sleepInRate))}` : rate != null ? `${formatCurrency(rate)}/h` : ""}
                      {s.isSleepIn ? <span className="block text-[10px] font-normal text-slate-500">sleep-in</span> : null}
                    </span>
                  </Panel>
                </li>
              );
            })}
          </ul>
        )}
      </Section>

      <p className="text-center text-xs text-slate-500">
        Sign off shifts by {weekdayName(user.agency.cutoffWeekday)} {formatTime(cutoff)} to be paid on {formatDate(payDay)}.
      </p>
    </div>
  );
}

function ShiftHero({ shift, profile, now }: { shift: ShiftRow; profile: Parameters<typeof carerRate>[0]; now: Date }) {
  const ts = shift.timesheet;
  const place = placeOf(shift);
  const address = [shift.site?.address, shift.site?.postcode].filter(Boolean).join(", ");
  const maps = address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${shift.site?.name ?? place}, ${address}`)}` : null;
  const onShift = ts && !ts.clockOut;
  const onBreak = Boolean(ts?.breakStartedAt);
  const subtitle = `${shift.title} · ${format(shift.startAt, "EEE d MMM")} · ${place}`;
  const label = onShift ? (onBreak ? "On a break" : "On shift") : ts?.clockOut ? "To sign off" : shift.startAt <= now ? "Starting now" : "Next shift";
  const rate = shift.isSleepIn ? null : carerRate(profile, shift.startAt, shift.endAt);

  return (
    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="space-y-3 p-5">
        <div className="flex items-center justify-between gap-2">
          <Pill tone={onShift ? (onBreak ? "amber" : "green") : ts?.clockOut ? "amber" : "brand"}>{label}</Pill>
          {onShift && ts ? <span className="font-mono text-sm font-semibold text-slate-900"><Elapsed since={ts.clockIn.toISOString()} /></span> : null}
        </div>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">{place}</h2>
          <p className="text-sm text-slate-600">{[shift.site && shift.client ? shift.site.name : null, shift.role].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-50 p-3 font-mono text-xs">
          <span className="flex items-center gap-1.5 text-slate-700"><Clock className="h-3.5 w-3.5 text-slate-400" />{formatTime(shift.startAt)}–{formatTime(shift.endAt)}</span>
          <span className="text-right text-slate-700">{shift.isSleepIn ? `Sleep-in ${formatCurrency(Number(shift.sleepInRate))}` : rate != null ? `${formatCurrency(rate)}/h` : ""}</span>
          {ts ? <span className="col-span-2 text-slate-500">Clocked in {formatTime(ts.clockIn)}{ts.clockInLat != null ? " · location recorded" : ""}{ts.clockOut ? ` · out ${formatTime(ts.clockOut)} · ${(ts.workedMins / 60).toFixed(1)} h paid` : ""}</span> : null}
        </div>
        {address ? <p className="flex items-start gap-1.5 text-xs text-slate-600"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />{address}</p> : null}
        {shift.site?.notes ? <p className="flex items-start gap-1.5 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-900"><StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0" />{shift.site.notes}</p> : null}
        {shift.notes ? <p className="text-xs text-slate-600">{shift.notes}</p> : null}
      </div>

      <div className="space-y-2 border-t border-slate-100 bg-slate-50/60 p-4">
        {!ts ? (
          <>
            <ClockInButton shiftId={shift.id} breakMins={shift.breakMins} action={clockInFormAction} />
            {maps ? (
              <a href={maps} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800">
                <Navigation className="h-4 w-4" />Directions
              </a>
            ) : null}
          </>
        ) : null}

        {onShift && ts ? (
          <>
            <form action={onBreak ? endBreakAction : startBreakAction}>
              <input type="hidden" name="timesheetId" value={ts.id} />
              <button type="submit" className={`flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold ${onBreak ? "bg-amber-500 text-white" : "border border-slate-200 bg-white text-slate-800"}`}>
                <Coffee className="h-4 w-4" />
                {onBreak && ts.breakStartedAt ? <>End break · <Elapsed since={ts.breakStartedAt.toISOString()} /></> : "Start break"}
              </button>
            </form>
            <form action={clockOutAction}>
              <input type="hidden" name="timesheetId" value={ts.id} />
              <button type="submit" className="w-full rounded-2xl bg-slate-900 px-4 py-4 text-base font-semibold text-white active:scale-[0.99]">Complete shift</button>
            </form>
            {ts.breakTakenMins > 0 ? <p className="text-center text-xs text-slate-500">Breaks so far: {ts.breakTakenMins} min</p> : null}
          </>
        ) : null}

        {ts?.clockOut && !ts.candidateSignedAt && !ts.clientAuthAt ? (
          <SignOffForm timesheetId={ts.id} mode="candidate" action={saveCandidateSignatureAction} buttonLabel="Sign off this shift" title="Sign off this shift" subtitle={subtitle} />
        ) : null}
        {ts?.candidateSignedAt && !ts.clientAuthAt ? (
          <>
            <p className="text-center text-xs font-medium text-amber-800">You&apos;ve signed. Now hand your phone to the person in charge to sign.</p>
            <SignOffForm timesheetId={ts.id} mode="client" action={saveClientAuthAction} buttonLabel="Get their signature" title="Sign off this shift" subtitle={subtitle} />
          </>
        ) : null}
      </div>
    </div>
  );
}
