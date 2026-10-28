import { addDays, format, isSameDay, startOfDay } from "date-fns";

import { requireUser } from "@/lib/auth";
import { clientName } from "@/lib/clients";
import { prisma } from "@/lib/db";
import { StatusBadge } from "@/components/status";

export const metadata = { title: "Calendar" };
export const dynamic = "force-dynamic";

const DAYS = 28;

/** The carer's own shifts for the next four weeks, day by day. */
export default async function WorkforceCalendarPage() {
  const user = await requireUser();
  const profile = user.staff;
  if (!profile) {
    return <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">No carer profile linked yet.</div>;
  }
  const today = startOfDay(new Date());
  const shifts = await prisma.shift.findMany({
    where: { agencyId: user.agencyId, staffId: profile.id, startAt: { gte: today, lt: addDays(today, DAYS) }, status: { notIn: ["CANCELLED"] } },
    include: { client: true, site: true },
    orderBy: { startAt: "asc" },
  });
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i));
  const booked = days.filter((d) => shifts.some((s) => isSameDay(s.startAt, d)));

  return (
    <div className="space-y-5 pb-8">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">Calendar</h1>
        <p className="text-xs text-slate-500">Your shifts for the next four weeks.</p>
      </div>

      <div className="grid grid-cols-7 gap-1 rounded-2xl border border-slate-200 bg-white p-3 text-center">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => <span key={i} className="text-[10px] font-semibold text-slate-400">{d}</span>)}
        {Array.from({ length: (today.getDay() + 6) % 7 }, (_, i) => <span key={`pad${i}`} />)}
        {days.map((d) => {
          const has = shifts.some((s) => isSameDay(s.startAt, d));
          return (
            <span key={d.toISOString()} className={`rounded-lg py-1.5 text-xs ${has ? "bg-slate-900 font-bold text-white" : isSameDay(d, today) ? "border border-slate-300 font-semibold text-slate-900" : "text-slate-500"}`}>
              {format(d, "d")}
            </span>
          );
        })}
      </div>

      {booked.length === 0 ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">No shifts booked in the next four weeks. Open shifts are under Pool.</div>
      ) : (
        <div className="space-y-4">
          {booked.map((d) => (
            <section key={d.toISOString()} className="space-y-2">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">{isSameDay(d, today) ? "Today" : format(d, "EEEE d MMMM")}</h2>
              {shifts.filter((s) => isSameDay(s.startAt, d)).map((s) => (
                <div key={s.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900">{s.title}</p>
                    <p className="text-xs text-slate-600">{s.client ? clientName(s.client) : (s.site?.name ?? "Location to be confirmed")}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{format(s.startAt, "HH:mm")} – {format(s.endAt, "HH:mm")}</p>
                  </div>
                  <StatusBadge status={s.status} />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
