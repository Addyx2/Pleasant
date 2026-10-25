import { prisma } from "@/lib/db";

/**
 * List prices for the Assist model, in US dollars per million tokens. Cache
 * writes use the 5-minute rate (1.25x input). Estimates only: a refusal
 * fallback can bill a turn at another model's rates.
 */
export const PRICE_PER_MTOK = { input: 4, output: 20, cacheRead: 0.2, cacheWrite: 5 } as const;

export const DEFAULT_MONTHLY_CAP_USD = 50;

export interface UsageTokens {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Estimated cost of one model call, in millionths of a US dollar. */
export function costMicros(usage: UsageTokens): number {
  return Math.round(
    usage.input_tokens * PRICE_PER_MTOK.input +
      usage.output_tokens * PRICE_PER_MTOK.output +
      (usage.cache_read_input_tokens ?? 0) * PRICE_PER_MTOK.cacheRead +
      (usage.cache_creation_input_tokens ?? 0) * PRICE_PER_MTOK.cacheWrite,
  );
}

const monthFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit" });

/** The UK calendar month a moment falls in, e.g. "2026-10". */
export function usageMonth(at: Date = new Date()): string {
  return monthFormat.format(at).slice(0, 7);
}

/** The agency's cap in dollars: its own override, else the environment default. */
export function monthlyCapUsd(agencyCap: number | null | undefined, env: string | undefined = process.env.ASSIST_MONTHLY_CAP_USD): number {
  if (agencyCap != null && agencyCap >= 0) return agencyCap;
  const fromEnv = Number(env);
  return env && Number.isFinite(fromEnv) && fromEnv >= 0 ? fromEnv : DEFAULT_MONTHLY_CAP_USD;
}

export interface Allowance {
  month: string;
  usedMicros: number;
  capMicros: number;
  /** 0–100, rounded down so "100%" only shows once the cap is reached. */
  percent: number;
  exhausted: boolean;
}

export function allowanceFrom(month: string, usedMicros: number, capUsd: number): Allowance {
  const capMicros = Math.round(capUsd * 1_000_000);
  const percent = capMicros > 0 ? Math.min(100, Math.floor((usedMicros / capMicros) * 100)) : 100;
  return { month, usedMicros, capMicros, percent, exhausted: usedMicros >= capMicros };
}

export async function getAllowance(agencyId: string): Promise<Allowance> {
  const month = usageMonth();
  const [agency, sum] = await Promise.all([
    prisma.agency.findUnique({ where: { id: agencyId }, select: { assistMonthlyCapUsd: true } }),
    prisma.assistUsage.aggregate({ where: { agencyId, month }, _sum: { costMicros: true } }),
  ]);
  return allowanceFrom(month, sum._sum.costMicros ?? 0, monthlyCapUsd(agency?.assistMonthlyCapUsd));
}

export const ALLOWANCE_REACHED =
  "Your agency has used this month's Assist allowance. It resets on the 1st; to raise it, contact Pleasant support.";

/** Adds one model call to the person's running total for this month. */
export async function recordUsage(agencyId: string, userId: string, usage: UsageTokens): Promise<void> {
  const month = usageMonth();
  const counts = {
    requests: 1,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: usage.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage.cache_creation_input_tokens ?? 0,
    costMicros: costMicros(usage),
  };
  await prisma.assistUsage.upsert({
    where: { agencyId_month_userId: { agencyId, month, userId } },
    create: { agencyId, month, userId, ...counts },
    update: Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { increment: v }])),
  });
}
