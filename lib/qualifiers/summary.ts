import Anthropic from "@anthropic-ai/sdk";

import { ASSIST_MODEL } from "@/lib/assist/agent";
import { getAllowance, recordUsage } from "@/lib/assist/usage";
import { prisma } from "@/lib/db";

import { BANDS, LAYERS, summarise, type Qualifier } from "./index";

// The office's brief on Qualifiers, written by Claude from the computed
// index and nothing else, and kept until someone asks for a new one.

const key = (agencyId: string) => `qualifiers-summary:${agencyId}`;

export interface SavedSummary {
  text: string;
  at: string;
  by: string;
}

export async function savedSummary(agencyId: string): Promise<SavedSummary | null> {
  const row = await prisma.serviceKey.findUnique({ where: { name: key(agencyId) } });
  try {
    return row ? (JSON.parse(row.value) as SavedSummary) : null;
  } catch {
    return null;
  }
}

const SYSTEM = `You write a short brief for the office of a UK care staffing agency about its carers, from the Qualifiers index you are given. Qualifiers scores each carer from what the agency has recorded over 90 days: Reliability (turning up, on time, answering offers), Quality (homes signing off timesheets, disputes, complaints), Readiness (11 hours' rest between shifts, 48 hours a week) and Competence (training in date). Compliance (DBS, right to work) is a gate: "Not ready" means a check has failed.

Write plain UK English, under 220 words, in four short parts with these exact headings on their own lines: "Overall", "Act now", "Check in with", "Doing well". Under each, short lines starting with "- ". "Act now" is compliance gaps and things expiring. "Check in with" is carers whose scores or facts show a problem, with the fact that shows it. Name carers and quote the facts and numbers exactly as given. Never invent facts, reasons or advice about anyone's health or personal life, and never suggest disciplinary action: suggest a conversation, support or training. If a part has nobody, write "- Nobody".`;

function brief(all: Qualifier[]): string {
  const s = summarise(all);
  const lines = [
    `Agency index: ${s.index ?? "not enough history"}. Carers: ${s.total}. ${Object.entries(s.counts).map(([b, n]) => `${BANDS[b as keyof typeof BANDS].label}: ${n}`).join(", ")}.`,
    ...all.map((q) => {
      const layers = LAYERS.map((l) => `${l.label} ${q.layers[l.key].score ?? "n/a"} (${q.layers[l.key].facts.join("; ")})`).join(" | ");
      const gate = q.gate.clear ? "compliance clear" : `NOT READY: ${q.gate.gaps.join("; ")}`;
      const soon = q.gate.dueSoon.length ? ` | due soon: ${q.gate.dueSoon.join("; ")}` : "";
      return `${q.name} (${q.jobTitle}): ${BANDS[q.band].label}, index ${q.index ?? "n/a"}, ${gate}${soon} | ${layers}`;
    }),
  ];
  return lines.join("\n");
}

export async function writeSummary(agencyId: string, user: { id: string; firstName: string; lastName: string }, all: Qualifier[]): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) return { ok: false, error: "The AI summary needs ANTHROPIC_API_KEY set for Pleasant." };
  if ((await getAllowance(agencyId)).exhausted) return { ok: false, error: "This month's AI allowance is used up." };
  if (all.length === 0) return { ok: false, error: "There are no active carers to summarise." };

  const client = new Anthropic({ maxRetries: 2, timeout: 60_000 });
  const message = await client.beta.messages.create({
    model: ASSIST_MODEL,
    max_tokens: 4000,
    output_config: { effort: "low" },
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    system: SYSTEM,
    messages: [{ role: "user", content: brief(all) }],
  });
  await recordUsage(agencyId, user.id, message.usage).catch(() => undefined);
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text.trim()] : [])).join("\n").trim();
  if (!text || message.stop_reason === "refusal") return { ok: false, error: "The summary couldn't be written. Try again." };

  const value = JSON.stringify({ text, at: new Date().toISOString(), by: `${user.firstName} ${user.lastName}`.trim() } satisfies SavedSummary);
  await prisma.serviceKey.upsert({ where: { name: key(agencyId) }, create: { name: key(agencyId), value }, update: { value } });
  return { ok: true };
}
