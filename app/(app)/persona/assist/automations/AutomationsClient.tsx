"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import { CheckCircle2, Loader2, Mail, Pause, Pencil, Play, Plus, Repeat, Trash2, TriangleAlert, Zap } from "lucide-react";

import { WEEKDAY_NAMES } from "@/lib/assist/schedule";
import { cn } from "@/lib/utils";
import { Badge, Card, buttonClass, inputClass, labelClass, subtleButtonClass } from "@/components/ui";

import {
  deleteAutomationAction,
  runAutomationNowAction,
  saveAutomationAction,
  toggleAutomationAction,
  type AutomationFormState,
} from "./actions";

export interface AutomationItem {
  id: string;
  name: string;
  prompt: string;
  cadence: "DAILY" | "WEEKDAYS" | "WEEKLY";
  weekday: number | null;
  time: string;
  emailResult: boolean;
  enabled: boolean;
  schedule: string;
  nextRun: string;
  lastRun: string | null;
  lastStatus: string | null;
  lastError: string | null;
  owner?: string;
  runs: { id: string; at: string }[];
}

const TEMPLATES = [
  {
    name: "Morning briefing",
    cadence: "WEEKDAYS" as const,
    time: "07:30",
    prompt:
      "Give me a morning briefing: shifts today and tomorrow, any that still have no carer, timesheets waiting for approval, carers' shift requests to decide, and anything else that needs attention first.",
  },
  {
    name: "Next week's cover check",
    cadence: "WEEKLY" as const,
    weekday: 5,
    time: "12:00",
    prompt:
      "List every shift next week (Monday to Sunday) that has no carer yet, grouped by client, and suggest carers who are free and compliant for each.",
  },
  {
    name: "Compliance watch",
    cadence: "WEEKLY" as const,
    weekday: 1,
    time: "08:00",
    prompt:
      "Which active carers have a DBS, right to work or training that is missing, expired or expiring in the next 30 days? Group by carer, most urgent first.",
  },
  {
    name: "Timesheet chase",
    cadence: "WEEKDAYS" as const,
    time: "16:00",
    prompt:
      "Which timesheets are still waiting for approval, and which are missing the client's sign-off? List them by client so I can chase them before the payroll cutoff.",
  },
];

const ADMIN_TEMPLATES = [
  {
    name: "Overdue invoices",
    cadence: "WEEKLY" as const,
    weekday: 1,
    time: "09:00",
    prompt:
      "List issued invoices that are overdue, with the client, amount and days overdue, then the total outstanding. Flag anything more than 30 days overdue.",
  },
];

type Draft = {
  id?: string;
  name: string;
  prompt: string;
  cadence: "DAILY" | "WEEKDAYS" | "WEEKLY";
  weekday: number;
  time: string;
  emailResult: boolean;
};

const EMPTY: Draft = { name: "", prompt: "", cadence: "WEEKDAYS", weekday: 1, time: "07:30", emailResult: true };

function AutomationForm({ initial, onDone, role }: { initial: Draft; onDone: () => void; role: string }) {
  const [state, formAction, pending] = useActionState<AutomationFormState, FormData>(saveAutomationAction, {});
  const [draft, setDraft] = useState<Draft>(initial);

  useEffect(() => {
    if (state.success) onDone();
  }, [state, onDone]);

  const templates = [...TEMPLATES, ...(role === "ADMIN" ? ADMIN_TEMPLATES : [])];

  return (
    <Card className="p-5">
      <h2 className="text-sm font-semibold text-slate-900">{draft.id ? "Edit automation" : "New automation"}</h2>
      {!draft.id ? (
        <div className="mt-3">
          <p className="text-xs font-medium text-slate-500">Start from a template</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.name}
                type="button"
                onClick={() =>
                  setDraft({ ...EMPTY, name: t.name, prompt: t.prompt, cadence: t.cadence, time: t.time, weekday: "weekday" in t && t.weekday !== undefined ? t.weekday : 1 })
                }
                className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-brand-300 hover:bg-brand-50/60"
              >
                <Zap className="h-3 w-3 text-amber-500" /> {t.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <form action={formAction} className="mt-4 grid gap-4 sm:grid-cols-2">
        {draft.id ? <input type="hidden" name="id" value={draft.id} /> : null}
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="automation-name">Name</label>
          <input
            id="automation-name"
            name="name"
            required
            maxLength={80}
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Morning briefing"
            className={`${inputClass} mt-1`}
          />
        </div>
        <div className="sm:col-span-2">
          <label className={labelClass} htmlFor="automation-prompt">What should Assist do?</label>
          <textarea
            id="automation-prompt"
            name="prompt"
            required
            rows={4}
            maxLength={2000}
            value={draft.prompt}
            onChange={(e) => setDraft({ ...draft, prompt: e.target.value })}
            placeholder="Write it the way you'd ask Assist in chat."
            className={`${inputClass} mt-1`}
          />
          <p className="mt-1 text-xs text-slate-500">
            Automations run unattended, so they can look things up and report but never change anything. Open a
            run&apos;s conversation to ask Assist to act on it.
          </p>
        </div>
        <div>
          <label className={labelClass} htmlFor="automation-cadence">Repeats</label>
          <select
            id="automation-cadence"
            name="cadence"
            value={draft.cadence}
            onChange={(e) => setDraft({ ...draft, cadence: e.target.value as Draft["cadence"] })}
            className={`${inputClass} mt-1`}
          >
            <option value="DAILY">Every day</option>
            <option value="WEEKDAYS">Weekdays (Mon–Fri)</option>
            <option value="WEEKLY">Once a week</option>
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {draft.cadence === "WEEKLY" ? (
            <div>
              <label className={labelClass} htmlFor="automation-weekday">On</label>
              <select
                id="automation-weekday"
                name="weekday"
                value={draft.weekday}
                onChange={(e) => setDraft({ ...draft, weekday: Number(e.target.value) })}
                className={`${inputClass} mt-1`}
              >
                {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_NAMES[d]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <div className={draft.cadence === "WEEKLY" ? "" : "col-span-2"}>
            <label className={labelClass} htmlFor="automation-time">At (UK time)</label>
            <input
              id="automation-time"
              name="time"
              type="time"
              required
              value={draft.time}
              onChange={(e) => setDraft({ ...draft, time: e.target.value })}
              className={`${inputClass} mt-1`}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-700 sm:col-span-2">
          <input
            type="checkbox"
            name="emailResult"
            checked={draft.emailResult}
            onChange={(e) => setDraft({ ...draft, emailResult: e.target.checked })}
            className="h-4 w-4 rounded border-slate-300 accent-brand-600"
          />
          Email me the result
        </label>
        {state.error ? (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 sm:col-span-2">{state.error}</p>
        ) : null}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" disabled={pending} className={buttonClass}>
            {pending ? "Saving…" : draft.id ? "Save changes" : "Create automation"}
          </button>
          <button type="button" onClick={onDone} className={subtleButtonClass}>Cancel</button>
        </div>
      </form>
    </Card>
  );
}

function RunNowButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={cn(subtleButtonClass, "py-1.5 text-xs")}>
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      {pending ? "Running…" : "Run now"}
    </button>
  );
}

function AutomationCard({ item, onEdit, mine }: { item: AutomationItem; onEdit?: () => void; mine: boolean }) {
  return (
    <Card className={cn("p-5", !item.enabled && "bg-slate-50/60")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Repeat className="h-4 w-4 text-brand-600" />
            <h3 className="font-semibold text-slate-900">{item.name}</h3>
            {item.enabled ? <Badge tone="green">Active</Badge> : <Badge tone="slate">Paused</Badge>}
            {item.emailResult ? (
              <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                <Mail className="h-3.5 w-3.5" /> Emailed
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600">
            {item.schedule}
            {item.owner ? <span className="text-slate-400"> · owned by {item.owner}</span> : null}
          </p>
          {mine ? <p className="mt-2 line-clamp-2 max-w-2xl text-sm text-slate-500">“{item.prompt}”</p> : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <form action={runAutomationNowAction}>
            <input type="hidden" name="id" value={item.id} />
            <RunNowButton />
          </form>
          <form action={toggleAutomationAction}>
            <input type="hidden" name="id" value={item.id} />
            <input type="hidden" name="enabled" value={item.enabled ? "false" : "true"} />
            <button type="submit" className={cn(subtleButtonClass, "py-1.5 text-xs")}>
              {item.enabled ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
              {item.enabled ? "Pause" : "Resume"}
            </button>
          </form>
          {onEdit ? (
            <button type="button" onClick={onEdit} className={cn(subtleButtonClass, "py-1.5 text-xs")}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </button>
          ) : null}
          <form
            action={deleteAutomationAction}
            onSubmit={(e) => {
              if (!window.confirm(`Delete "${item.name}"? Past runs stay in history.`)) e.preventDefault();
            }}
          >
            <input type="hidden" name="id" value={item.id} />
            <button type="submit" aria-label={`Delete ${item.name}`} className={cn(subtleButtonClass, "py-1.5 text-xs text-red-600")}>
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>

      <dl className="mt-4 grid gap-3 border-t border-slate-100 pt-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs text-slate-500">Next run</dt>
          <dd className="mt-0.5 font-medium text-slate-900">{item.enabled ? item.nextRun : "Paused"}</dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500">Last run</dt>
          <dd className="mt-0.5 flex items-center gap-1.5 font-medium text-slate-900">
            {item.lastRun ? (
              <>
                {item.lastStatus === "OK" ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <TriangleAlert className="h-4 w-4 text-red-600" />
                )}
                {item.lastRun}
              </>
            ) : (
              "Not run yet"
            )}
          </dd>
          {item.lastStatus === "FAILED" && item.lastError ? <p className="mt-0.5 text-xs text-red-600">{item.lastError}</p> : null}
        </div>
        {mine ? (
          <div>
            <dt className="text-xs text-slate-500">Recent runs</dt>
            <dd className="mt-0.5 flex flex-wrap gap-x-3 gap-y-1">
              {item.runs.length === 0 ? (
                <span className="text-slate-400">None yet</span>
              ) : (
                item.runs.map((r) => (
                  <Link key={r.id} href={`/persona/assist/c/${r.id}`} className="font-medium text-brand-700 hover:text-brand-800">
                    {r.at}
                  </Link>
                ))
              )}
            </dd>
          </div>
        ) : null}
      </dl>
    </Card>
  );
}

export function AutomationsClient({
  mine,
  team,
  role,
}: {
  mine: AutomationItem[];
  team: AutomationItem[];
  role: string;
}) {
  const [editing, setEditing] = useState<Draft | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Your automations</h2>
          <p className="text-xs text-slate-500">Assist runs these on a schedule and saves each result in your history.</p>
        </div>
        {!editing ? (
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className={buttonClass}>
            <Plus className="h-4 w-4" /> New automation
          </button>
        ) : null}
      </div>

      {editing ? <AutomationForm key={editing.id ?? "new"} initial={editing} onDone={() => setEditing(null)} role={role} /> : null}

      {mine.length === 0 && !editing ? (
        <Card className="border-dashed p-8 text-center">
          <Repeat className="mx-auto h-6 w-6 text-slate-300" />
          <p className="mt-2 text-sm font-semibold text-slate-700">No automations yet</p>
          <p className="mt-1 text-sm text-slate-500">
            Schedule a morning briefing, a weekly cover check or a compliance watch, and get the result by email.
          </p>
          <button type="button" onClick={() => setEditing({ ...EMPTY })} className={cn(buttonClass, "mt-4")}>
            <Plus className="h-4 w-4" /> Create your first automation
          </button>
        </Card>
      ) : null}

      {mine.map((item) => (
        <AutomationCard
          key={item.id}
          item={item}
          mine
          onEdit={() =>
            setEditing({
              id: item.id,
              name: item.name,
              prompt: item.prompt,
              cadence: item.cadence,
              weekday: item.weekday ?? 1,
              time: item.time,
              emailResult: item.emailResult,
            })
          }
        />
      ))}

      {team.length > 0 ? (
        <div className="space-y-3 pt-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">Team automations</h2>
            <p className="text-xs text-slate-500">
              Automations your colleagues have scheduled. As an admin you can pause, run or delete them; their
              prompts and results stay private to them.
            </p>
          </div>
          {team.map((item) => (
            <AutomationCard key={item.id} item={item} mine={false} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
