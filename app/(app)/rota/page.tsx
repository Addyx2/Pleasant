import { CalendarPlus, Plus, Repeat, Trash2 } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatHhMm } from "@/lib/rota";
import { formatCurrency } from "@/lib/utils";
import { Card, EmptyState, PageHeader, inputClass, labelClass, subtleButtonClass } from "@/components/ui";
import {
  addRotaLineAction,
  createRotaTemplateAction,
  deleteRotaLineAction,
  deleteRotaTemplateAction,
  generateRotaWeekAction,
} from "./actions";

export const metadata = { title: "Recurring rota | Pleasant" };
export const dynamic = "force-dynamic";

const WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function todayIso(): string {
  const now = new Date();
  const m = `${now.getMonth() + 1}`.padStart(2, "0");
  const d = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${m}-${d}`;
}

export default async function RotaPage() {
  const user = await requireAdmin();

  const [templates, clients, staff, sites] = await Promise.all([
    prisma.rotaTemplate.findMany({
      where: { agencyId: user.agencyId },
      include: {
        lines: {
          include: { client: true, staff: true, site: true },
          orderBy: [{ weekday: "asc" }, { startMins: "asc" }],
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.staffProfile.findMany({
      where: { agencyId: user.agencyId, status: "ACTIVE" },
      orderBy: { lastName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    prisma.site.findMany({
      where: { agencyId: user.agencyId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const totalLines = templates.reduce((sum, t) => sum + t.lines.length, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Recurring rota"
        description="Describe your usual week once, then generate it whenever you need it. Lines below the cutoff are skipped so every shift still gets paid."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Templates</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">{templates.length}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Lines per week</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">{totalLines}</p>
        </Card>
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Shifts per generation</p>
          <p className="tabular mt-1.5 font-display text-3xl font-bold text-slate-900">{totalLines}</p>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="text-sm font-semibold text-slate-900">New template</h2>
        <form action={createRotaTemplateAction} className="mt-3 grid gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label className={labelClass} htmlFor="title">Template name</label>
            <input id="title" name="title" required placeholder="Meadow View — weekday cover" className={inputClass} />
          </div>
          <div className="flex items-end">
            <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
              <Plus className="h-4 w-4" /> Create template
            </button>
          </div>
        </form>
      </Card>

      {templates.length === 0 ? (
        <EmptyState
          title="No rota templates yet"
          description="Create a template, add the shifts you repeat every week, then generate a week in one click."
        />
      ) : (
        templates.map((template) => (
          <Card key={template.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
              <div className="flex items-center gap-2.5">
                <Repeat className="h-4 w-4 text-slate-400" />
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">{template.title}</h2>
                  <p className="text-xs text-slate-500">
                    {template.lines.length} line{template.lines.length === 1 ? "" : "s"} per week
                    {template.notes ? ` · ${template.notes}` : ""}
                  </p>
                </div>
              </div>
              <form action={deleteRotaTemplateAction}>
                <input type="hidden" name="templateId" value={template.id} />
                <button type="submit" className="text-xs font-medium text-red-600 hover:underline">
                  Delete template
                </button>
              </form>
            </div>

            {template.lines.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">Day</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">Shift</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">Time</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">Client</th>
                      <th className="px-5 py-2.5 text-left text-xs font-semibold text-slate-500">Carer</th>
                      <th className="px-5 py-2.5 text-right text-xs font-semibold text-slate-500">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {template.lines.map((line) => {
                      const day = WEEKDAYS.find((d) => d.value === line.weekday);
                      return (
                        <tr key={line.id}>
                          <td className="px-5 py-3 text-sm font-medium text-slate-900">{day?.label}</td>
                          <td className="px-5 py-3 text-sm text-slate-700">
                            {line.title}
                            <span className="text-xs text-slate-500"> · {line.role}</span>
                            {line.isSleepIn ? (
                              <span className="ml-1 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-700">
                                Sleep-in {formatCurrency(Number(line.sleepInRate))}
                              </span>
                            ) : null}
                          </td>
                          <td className="tabular px-5 py-3 text-sm text-slate-700">
                            {formatHhMm(line.startMins)} – {formatHhMm(line.endMins)}
                            {line.breakMins > 0 ? (
                              <span className="text-xs text-slate-500"> · {line.breakMins}m break</span>
                            ) : null}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-700">
                            {line.client ? `${line.client.firstName} ${line.client.lastName}` : "—"}
                            {line.site ? <p className="text-xs text-slate-500">{line.site.name}</p> : null}
                          </td>
                          <td className="px-5 py-3 text-sm text-slate-700">
                            {line.staff ? `${line.staff.firstName} ${line.staff.lastName}` : (
                              <span className="text-amber-700">Unassigned</span>
                            )}
                          </td>
                          <td className="px-5 py-3 text-right">
                            <form action={deleteRotaLineAction}>
                              <input type="hidden" name="lineId" value={line.id} />
                              <button
                                type="submit"
                                className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:underline"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Remove
                              </button>
                            </form>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : null}

            <div className="grid gap-6 border-t border-slate-200 p-5 lg:grid-cols-2">
              <form action={addRotaLineAction} className="space-y-3">
                <input type="hidden" name="templateId" value={template.id} />
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Add a line</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className={labelClass} htmlFor={`weekday-${template.id}`}>Day</label>
                    <select id={`weekday-${template.id}`} name="weekday" defaultValue="1" className={inputClass}>
                      {WEEKDAYS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`title-${template.id}`}>Shift name</label>
                    <input id={`title-${template.id}`} name="title" required placeholder="Day shift" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`role-${template.id}`}>Role</label>
                    <input id={`role-${template.id}`} name="role" required placeholder="Care Assistant" className={inputClass} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className={labelClass} htmlFor={`startTime-${template.id}`}>Start</label>
                      <input id={`startTime-${template.id}`} name="startTime" type="time" required defaultValue="07:00" className={inputClass} />
                    </div>
                    <div>
                      <label className={labelClass} htmlFor={`endTime-${template.id}`}>End</label>
                      <input id={`endTime-${template.id}`} name="endTime" type="time" required defaultValue="15:00" className={inputClass} />
                    </div>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`breakMins-${template.id}`}>Break (mins)</label>
                    <input id={`breakMins-${template.id}`} name="breakMins" type="number" min="0" defaultValue="30" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`chargeRate-${template.id}`}>Charge rate (£/hr)</label>
                    <input id={`chargeRate-${template.id}`} name="chargeRate" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`clientId-${template.id}`}>Client</label>
                    <select id={`clientId-${template.id}`} name="clientId" className={inputClass}>
                      <option value="">None</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.firstName} {c.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`siteId-${template.id}`}>Site</label>
                    <select id={`siteId-${template.id}`} name="siteId" className={inputClass}>
                      <option value="">None</option>
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass} htmlFor={`staffId-${template.id}`}>Carer</label>
                    <select id={`staffId-${template.id}`} name="staffId" className={inputClass}>
                      <option value="">Unassigned (goes to dispatch)</option>
                      {staff.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.firstName} {s.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <button type="submit" className={subtleButtonClass}>
                  <Plus className="h-4 w-4" /> Add line
                </button>
              </form>

              <form action={generateRotaWeekAction} className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Generate a week</p>
                <p className="text-xs text-slate-500">
                  Any date inside the week works — it snaps to that week&apos;s Monday. Existing shifts are not
                  duplicated; lines already past the cutoff are skipped.
                </p>
                <input type="hidden" name="templateId" value={template.id} />
                <div>
                  <label className={labelClass} htmlFor={`weekStart-${template.id}`}>Week of</label>
                  <input id={`weekStart-${template.id}`} name="weekStart" type="date" defaultValue={todayIso()} className={inputClass} />
                </div>
                <button type="submit" className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
                  <CalendarPlus className="h-4 w-4" /> Generate this week&apos;s shifts
                </button>
              </form>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}