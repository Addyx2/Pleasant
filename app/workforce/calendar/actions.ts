"use server";

import { addDays, differenceInCalendarDays } from "date-fns";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireUser } from "@/lib/auth";
import { ukDate } from "@/lib/availability";
import { prisma } from "@/lib/db";

export interface AvailabilityState {
  ok?: string;
  error?: string;
}

const schema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("dates"), from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a first day"), to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a last day"), reason: z.string().trim().max(80) }),
  z.object({ kind: z.literal("weekly"), weekday: z.coerce.number().int().min(1).max(7), until: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/), reason: z.string().trim().max(80) }),
]);

/** A carer says when they can't work. Their agency then can't book or offer them shifts then. */
export async function addUnavailabilityAction(_prev: AvailabilityState, formData: FormData): Promise<AvailabilityState> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (user.role !== "STAFF" || !staffId) return { error: "Only carers can set their availability." };
  const parsed = schema.safeParse(Object.fromEntries(["kind", "from", "to", "weekday", "until", "reason"].map((k) => [k, String(formData.get(k) ?? "")])));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Check the details" };
  const today = ukDate(new Date());
  const d = parsed.data;

  let startsOn: string;
  let endsOn: string;
  let weekday: number | null = null;
  if (d.kind === "dates") {
    if (d.to < d.from) return { error: "The last day must be on or after the first day." };
    if (d.to < today) return { error: "Those days have already passed." };
    if (differenceInCalendarDays(new Date(d.to), new Date(d.from)) > 365) return { error: "Choose a range of up to a year." };
    startsOn = d.from < today ? today : d.from;
    endsOn = d.to;
  } else {
    startsOn = today;
    endsOn = d.until || ukDate(addDays(new Date(), 365));
    if (endsOn < today) return { error: "Choose an end date in the future." };
    weekday = d.weekday;
  }
  await prisma.staffUnavailability.create({
    data: { agencyId: user.agencyId, staffId, startsOn: new Date(`${startsOn}T00:00:00Z`), endsOn: new Date(`${endsOn}T00:00:00Z`), weekday, reason: d.reason || null },
  });
  revalidatePath("/workforce/calendar");
  return { ok: "Saved. Your agency won't book you then." };
}

export async function removeUnavailabilityAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const staffId = user.staff?.id;
  if (!staffId) return;
  await prisma.staffUnavailability.deleteMany({ where: { id: String(formData.get("id") ?? ""), staffId, agencyId: user.agencyId } });
  revalidatePath("/workforce/calendar");
}
