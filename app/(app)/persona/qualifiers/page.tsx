import Link from "next/link";
import { Gauge, ShieldAlert, Sparkles } from "lucide-react";

import { requireOps } from "@/lib/auth";
import { BANDS, LAYERS, qualifiers, summarise, WINDOW_DAYS, type Band } from "@/lib/qualifiers";
import { savedSummary } from "@/lib/qualifiers/summary";
import { Badge, Card, EmptyState, buttonClass } from "@/components/ui";
import { cn } from "@/lib/utils";

import { writeSummaryAction } from "./actions";

export const metadata = { title: "Qualifiers" };
export const dynamic = "force-dynamic";

const when = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const ORDER: Band[] = ["blocked", "support", "watch", "good", "excellent", "new"];

function Score({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-300">—</span>;
  return <span className={cn("tabular font-semibold", value >= 85 ? "text-emerald-700" : value >= 70 ? "text-sky-700" : value >= 50 ? "text-amber-700" : "text-red-700")}>{value}</span>;
}

export default async function QualifiersPage({ searchParams }: { searchParams: Promise<{ band?: string; error?: string }> }) {
  const user = await requireOps();
  const { band, error } = await searchParams;
  const [all, summary] = await Promise.all([qualifiers(user.agencyId), savedSummary(user.agencyId)]);
  const s = summarise(all);
  const shown = all
    .filter((q) => !band || q.band === band)
    .sort((a, b) => ORDER.indexOf(a.band) - ORDER.indexOf(b.band) || (a.index ?? 101) - (b.index ?? 101) || a.name.localeCompare(b.name));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900">
          <Gauge className="h-4 w-4 text-brand-300" />
        </span>
        <div>
          <Link href="/persona" className="text-[11px] font-semibold uppercase tracking-wider text-brand-600 hover:text-brand-700">Persona</Link>
          <h1 className="font-display text-xl font-bold leading-tight tracking-tight text-slate-900">Qualifiers</h1>
          <p className="text-xs text-slate-500">How every carer is doing, layer by layer, from the last {WINDOW_DAYS} days of records. Compliance is a gate.</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="p-5">
          <p className="text-[13px] font-medium text-slate-500">Agency index</p>
          <p className="mt-1.5 font-display text-4xl font-bold tracking-tight text-slate-900">{s.index ?? "—"}</p>
          <p className="mt-1 text-xs text-slate-500">
            {(() => {
              const n = s.total - s.counts.new - s.counts.blocked;
              return n ? `Average over ${n} carer${n === 1 ? "" : "s"} with enough history and clear compliance.` : "Nobody has enough history and clear compliance yet.";
            })()}
          </p>
          <div className="mt-4 flex flex-wrap gap-1.5">
            <Link href="/persona/qualifiers" className={cn("rounded-full border px-2.5 py-0.5 text-xs", !band ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>All {s.total}</Link>
            {ORDER.map((b) => (
              <Link key={b} href={`/persona/qualifiers?band=${b}`} className={cn("rounded-full border px-2.5 py-0.5 text-xs", band === b ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                {BANDS[b].label} {s.counts[b]}
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-brand-600" />
              <h2 className="text-sm font-semibold text-slate-900">Summary</h2>
            </div>
            <form action={writeSummaryAction}>
              <button type="submit" className={buttonClass}>{summary ? "Write a new summary" : "Write a summary"}</button>
            </form>
          </div>
          {error ? <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
          {summary ? (
            <>
              <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">{summary.text}</div>
              <p className="mt-3 text-xs text-slate-400">Written by AI from the index below, {when.format(new Date(summary.at))} for {summary.by}. Check anything before acting on it.</p>
            </>
          ) : (
            <p className="mt-3 text-sm text-slate-500">AI reads the index below and writes the office a brief: who needs action now, who to check in with, and who&apos;s doing well. It uses only these facts.</p>
          )}
        </Card>
      </div>

      {shown.length === 0 ? (
        <EmptyState icon={Gauge} title={band ? "Nobody in this band" : "No active carers"} />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-left text-xs font-semibold text-slate-500">
                <th className="px-4 py-3">Carer</th>
                <th className="px-4 py-3">Index</th>
                {LAYERS.map((l) => (
                  <th key={l.key} className="px-4 py-3" title={`Weighted ${l.weight}%: ${l.anchors}`}>{l.label}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shown.map((q) => (
                <tr key={q.staffId} className="align-top">
                  <td className="px-4 py-3">
                    <Link href={`/staff/${q.staffId}`} className="font-medium text-slate-900 hover:text-brand-700">{q.name}</Link>
                    <p className="text-xs text-slate-500">{q.jobTitle}</p>
                    {!q.gate.clear ? (
                      <p className="mt-1 flex items-start gap-1 text-xs text-red-700"><ShieldAlert className="mt-0.5 h-3 w-3 shrink-0" />{q.gate.gaps.join("; ")}</p>
                    ) : null}
                    {q.gate.dueSoon.length ? <p className="mt-1 text-xs text-amber-700">{q.gate.dueSoon.join("; ")}</p> : null}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="font-display text-lg font-bold text-slate-900">{q.index ?? "—"}</span>
                      <Badge tone={BANDS[q.band].tone}>{BANDS[q.band].label}</Badge>
                    </div>
                    {q.weak.length && q.band === "watch" ? <p className="mt-1 text-xs text-amber-700">Held at Watch by {q.weak.join(" and ")}</p> : null}
                  </td>
                  {LAYERS.map((l) => (
                    <td key={l.key} className="px-4 py-3">
                      <Score value={q.layers[l.key].score} />
                      <ul className="mt-1 space-y-0.5 text-xs text-slate-500">
                        {q.layers[l.key].facts.map((f) => <li key={f}>{f}</li>)}
                      </ul>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <p className="text-xs text-slate-400">
        Weights: {LAYERS.map((l) => `${l.label} ${l.weight}%`).join(", ")}, over the layers with enough to judge by. Any layer under 50 holds a carer at Watch. Carers need 3 shifts in {WINDOW_DAYS} days for an index.
      </p>
    </div>
  );
}
