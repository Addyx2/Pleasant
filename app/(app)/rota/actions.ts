"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOps } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getBankHolidays } from "@/lib/integrations/bank-holidays";
import { isValidLine, lineDateFor, lineEndFor, parseHhMm, buildWeek } from "@/lib/rota";
import { resolveChargeRate, resolveSleepInCharge, toRateCardEntry, type RateCardEntry } from "@/lib/clients";
import { nextCutoff } from "@/lib/week";

function weekdayFrom(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 6) return 1;
  return parsed;
}

export async function createRotaTemplateAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.rotaTemplate.create({
    data: { agencyId: user.agencyId, title, notes: String(formData.get("notes") ?? "").trim() || null },
  });

  revalidatePath("/rota");
}

export async function deleteRotaTemplateAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const templateId = String(formData.get("templateId") ?? "");
  if (!templateId) return;

  await prisma.rotaTemplate.deleteMany({ where: { id: templateId, agencyId: user.agencyId } });
  revalidatePath("/rota");
}

export async function addRotaLineAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const templateId = String(formData.get("templateId") ?? "");
  const role = String(formData.get("role") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const startMins = parseHhMm(String(formData.get("startTime") ?? ""));
  const endMins = parseHhMm(String(formData.get("endTime") ?? ""));

  if (!templateId || startMins === null || endMins === null) return;
  if (!isValidLine({ startMins, endMins, role, title })) return;

  const template = await prisma.rotaTemplate.findFirst({
    where: { id: templateId, agencyId: user.agencyId },
    select: { id: true },
  });
  if (!template) return;

  await prisma.rotaTemplateLine.create({
    data: {
      templateId,
      weekday: weekdayFrom(String(formData.get("weekday") ?? "1")),
      role,
      title,
      startMins,
      endMins,
      breakMins: Math.max(0, Number(formData.get("breakMins") ?? 0) || 0),
      isSleepIn: formData.get("isSleepIn") === "on",
      sleepInRate: Math.max(0, Number(formData.get("sleepInRate") ?? 0) || 0),
      chargeRate: Math.max(0, Number(formData.get("chargeRate") ?? 0) || 0),
      clientId: String(formData.get("clientId") ?? "") || null,
      staffId: String(formData.get("staffId") ?? "") || null,
      siteId: String(formData.get("siteId") ?? "") || null,
    },
  });

  revalidatePath("/rota");
}

export async function deleteRotaLineAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const lineId = String(formData.get("lineId") ?? "");
  if (!lineId) return;

  await prisma.rotaTemplateLine.deleteMany({
    where: { id: lineId, template: { agencyId: user.agencyId } },
  });

  revalidatePath("/rota");
}

export async function generateRotaWeekAction(formData: FormData): Promise<void> {
  const user = await requireOps();
  const templateId = String(formData.get("templateId") ?? "");
  const weekStartRaw = String(formData.get("weekStart") ?? "").trim();
  if (!templateId || !weekStartRaw) return;

  const template = await prisma.rotaTemplate.findFirst({
    where: { id: templateId, agencyId: user.agencyId },
    include: { lines: true },
  });
  if (!template || template.lines.length === 0) return;

  const parsedStart = new Date(weekStartRaw);
  if (Number.isNaN(parsedStart.getTime())) return;

  const { days } = buildWeek(parsedStart);

  // Never generate a shift that has already passed the payroll cutoff —
  // it would never make it onto a pay run.
  const cutoff = nextCutoff({
    cutoffWeekday: user.agency.cutoffWeekday,
    cutoffTime: user.agency.cutoffTime,
    payWeekday: user.agency.payWeekday,
  });
  const earliest = new Date(cutoff);

  const toCreate = [];
  for (const line of template.lines) {
    if (!isValidLine(line)) continue;
    const day = days.find((d) => d.weekday === line.weekday);
    if (!day) continue;
    const startAt = lineDateFor(line, day.date);
    const endAt = lineEndFor(line, startAt);
    if (startAt < earliest) continue;
    toCreate.push({ line, startAt, endAt });
  }

  // The UI promises "existing shifts are not duplicated". Match on the exact
  // slot the line would occupy so re-running a generation is safe.
  let toInsert = toCreate;
  if (toCreate.length > 0) {
    const existing = await prisma.shift.findMany({
      where: {
        agencyId: user.agencyId,
        startAt: { in: toCreate.map((c) => c.startAt) },
      },
      select: { startAt: true, endAt: true, title: true, clientId: true, siteId: true },
    });
    const key = (s: { startAt: Date; endAt: Date; title: string; clientId: string | null; siteId: string | null }) =>
      `${s.startAt.toISOString()}|${s.endAt.toISOString()}|${s.title}|${s.clientId ?? ""}|${s.siteId ?? ""}`;
    const taken = new Set(existing.map(key));
    toInsert = toCreate.filter(
      (c) => !taken.has(key({ startAt: c.startAt, endAt: c.endAt, title: c.line.title, clientId: c.line.clientId, siteId: c.line.siteId })),
    );
  }

  if (toInsert.length > 0) {
    // Lines without their own charge rate (0) are priced from the client's
    // rate card for the actual date, so weekend and bank-holiday rates apply.
    const clientIds = [...new Set(toInsert.map((c) => c.line.clientId).filter((id): id is string => !!id))];
    const rateRows = clientIds.length
      ? await prisma.clientRate.findMany({ where: { agencyId: user.agencyId, clientId: { in: clientIds } } })
      : [];
    const cards = new Map<string, RateCardEntry[]>();
    for (const row of rateRows) cards.set(row.clientId, [...(cards.get(row.clientId) ?? []), toRateCardEntry(row)]);
    const bankHolidays = await getBankHolidays(user.agency.bankHolidayDivision);
    const priced = (line: (typeof toInsert)[number]["line"], startAt: Date, endAt: Date) => {
      const card = line.clientId ? (cards.get(line.clientId) ?? []) : [];
      const chargeRate =
        Number(line.chargeRate) > 0
          ? Number(line.chargeRate)
          : (resolveChargeRate(card, { role: line.role, siteId: line.siteId, startAt, endAt }, bankHolidays)?.rate ?? 0);
      const sleepInCharge = line.isSleepIn
        ? line.sleepInCharge != null
          ? Number(line.sleepInCharge)
          : resolveSleepInCharge(card, { role: line.role, siteId: line.siteId })
        : null;
      return { chargeRate, sleepInCharge };
    };

    await prisma.shift.createMany({
      data: toInsert.map(({ line, startAt, endAt }) => ({
        ...priced(line, startAt, endAt),
        agencyId: user.agencyId,
        clientId: line.clientId,
        siteId: line.siteId,
        title: line.title,
        role: line.role,
        startAt,
        endAt,
        breakMins: line.breakMins,
        status: line.staffId ? ("ASSIGNED" as const) : ("OPEN" as const),
        staffId: line.staffId,
        isSleepIn: line.isSleepIn,
        sleepInRate: line.sleepInRate,
        rotaTemplateId: line.templateId,
      })),
    });
  }

  const skipped = toCreate.length - toInsert.length;

  revalidatePath("/shifts");
  revalidatePath("/dispatch");
  revalidatePath("/rota");
  revalidatePath("/dashboard");

  // Say what happened: the lines already on the rota, or before the payroll
  // cutoff, are skipped rather than duplicated.
  const pastCutoff = template.lines.length - toCreate.length;
  redirect(`/rota?generated=${toInsert.length}&skipped=${skipped + pastCutoff}`);
}
