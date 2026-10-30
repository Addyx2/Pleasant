import { complianceGaps, expiryState } from "@/lib/compliance";
import { prisma } from "@/lib/db";

// Qualifiers: how each carer is doing, layer by layer, from what Pleasant
// has actually recorded over the last 90 days. Compliance is a gate, not a
// score: one failed check means "not ready", whatever else is true. The
// other layers are scored 0–100 only when there's enough to judge by, and
// every score shows the facts it came from. Nothing is guessed.
//
//   Competence   training on file and in date
//   Readiness    rest between shifts (11 hours) and hours worked (48 a week)
//   Reliability  turning up, being on time, answering offers
//   Quality      homes signing off their timesheets, no disputes or complaints

export const WINDOW_DAYS = 90;
const DAY = 86_400_000;
const HOUR = 3_600_000;
const LATE_MINS = 10;
const MIN_REST_HOURS = 11;

export type LayerKey = "competence" | "readiness" | "reliability" | "quality";
export const LAYERS: { key: LayerKey; label: string; weight: number; anchors: string }[] = [
  { key: "reliability", label: "Reliability", weight: 35, anchors: "attendance, punctuality and answering offers" },
  { key: "quality", label: "Quality", weight: 30, anchors: "homes' sign-offs, disputes and complaints" },
  { key: "readiness", label: "Readiness", weight: 20, anchors: "the Working Time Regulations 1998: 11 hours' rest, 48 hours a week" },
  { key: "competence", label: "Competence", weight: 15, anchors: "training records and their expiry" },
];

export interface Layer {
  /** 0–100, or null when there isn't enough to judge by. */
  score: number | null;
  facts: string[];
}

export type Band = "excellent" | "good" | "watch" | "support" | "blocked" | "new";

export interface Qualifier {
  staffId: string;
  name: string;
  jobTitle: string;
  gate: { clear: boolean; gaps: string[]; dueSoon: string[] };
  layers: Record<LayerKey, Layer>;
  /** Weighted over the layers that have a score; null for carers new to the agency. */
  index: number | null;
  band: Band;
  /** Layers scoring under 50, which hold the band at Watch however good the rest is. */
  weak: string[];
}

export const BANDS: Record<Band, { label: string; tone: "green" | "blue" | "amber" | "red" | "slate" }> = {
  excellent: { label: "Excellent", tone: "green" },
  good: { label: "Good", tone: "blue" },
  watch: { label: "Watch", tone: "amber" },
  support: { label: "Needs support", tone: "red" },
  blocked: { label: "Not ready", tone: "red" },
  new: { label: "New", tone: "slate" },
};

/** Everything the index is worked out from, for one carer. */
export interface Record90 {
  staffId: string;
  name: string;
  jobTitle: string;
  compliance: { dbsNumber: string | null; dbsExpiry: Date | null; rightToWork: { status: string; expiryDate: Date | null } | null };
  training: { courseName: string; expiryDate: Date | null; status: string }[];
  /** Shifts that have ended in the window, plus the next 7 days', each with its timesheet if any. */
  shifts: { startAt: Date; endAt: Date; breakMins: number; status: string; timesheet: { clockIn: Date; status: string; clientAuthAt: Date | null } | null }[];
  offers: { sent: number; answered: number };
  complaints: { severity: string; status: string }[];
}

const pct = (n: number, d: number) => Math.round((100 * n) / d);
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function score(r: Record90, now = new Date()): Qualifier {
  const gaps = complianceGaps(r.compliance, now);
  const dueSoon = [
    ...(r.compliance.dbsExpiry && expiryState(r.compliance.dbsExpiry, now) === "DUE_SOON" ? ["DBS renewal due soon"] : []),
    ...(r.compliance.rightToWork?.expiryDate && expiryState(r.compliance.rightToWork.expiryDate, now) === "DUE_SOON" ? ["right to work expires soon"] : []),
    ...r.training.filter((t) => t.expiryDate && expiryState(t.expiryDate, now) === "DUE_SOON").map((t) => `${t.courseName} expires soon`),
  ];

  // Competence: training in date.
  const inDate = r.training.filter((t) => !t.expiryDate || expiryState(t.expiryDate, now) !== "EXPIRED");
  const competence: Layer =
    r.training.length === 0
      ? { score: null, facts: ["no training on file"] }
      : { score: pct(inDate.length, r.training.length), facts: [`${inDate.length} of ${r.training.length} training records in date`] };

  // Readiness: rest between shifts and hours, last 30 days and the coming week.
  const worked = r.shifts.filter((s) => s.status !== "CANCELLED" && s.startAt > new Date(now.getTime() - 30 * DAY)).sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
  let shortRests = 0;
  for (let i = 1; i < worked.length; i++) {
    const rest = (worked[i].startAt.getTime() - worked[i - 1].endAt.getTime()) / HOUR;
    if (rest >= 0 && rest < MIN_REST_HOURS) shortRests++;
  }
  const hoursIn = (from: Date, to: Date) =>
    worked.filter((s) => s.startAt >= from && s.startAt < to).reduce((h, s) => h + Math.max(0, (s.endAt.getTime() - s.startAt.getTime()) / HOUR - s.breakMins / 60), 0);
  const lastWeek = hoursIn(new Date(now.getTime() - 7 * DAY), now);
  const nextWeek = hoursIn(now, new Date(now.getTime() + 7 * DAY));
  const busiest = Math.max(lastWeek, nextWeek);
  const readiness: Layer =
    worked.length === 0
      ? { score: null, facts: ["no shifts in the last 30 days or the coming week"] }
      : {
          score: clamp(100 - 25 * shortRests - (busiest > 48 ? 20 : 0)),
          facts: [
            shortRests === 0 ? "always 11 hours' rest between shifts" : `${shortRests} gap${shortRests === 1 ? "" : "s"} under 11 hours between shifts`,
            `${Math.round(lastWeek)}h last 7 days, ${Math.round(nextWeek)}h booked next 7`,
            ...(busiest > 48 ? ["over 48 hours in a week"] : []),
          ],
        };

  // Reliability: shifts that should have happened.
  const due = r.shifts.filter((s) => s.endAt <= now && ["COMPLETED", "NO_SHOW", "IN_PROGRESS", "ASSIGNED"].includes(s.status));
  const noShows = due.filter((s) => s.status === "NO_SHOW").length;
  const clocked = due.filter((s) => s.timesheet);
  const onTime = clocked.filter((s) => s.timesheet!.clockIn.getTime() <= s.startAt.getTime() + LATE_MINS * 60_000).length;
  const parts: number[] = [];
  const relFacts: string[] = [];
  if (due.length >= 3) {
    parts.push(1 - Math.min(1, (2 * noShows) / due.length));
    relFacts.push(noShows === 0 ? `turned up for all ${due.length} shifts` : `${noShows} no-show${noShows === 1 ? "" : "s"} in ${due.length} shifts`);
  }
  if (clocked.length >= 3) {
    parts.push(onTime / clocked.length);
    relFacts.push(`on time for ${onTime} of ${clocked.length}`);
  }
  if (r.offers.sent >= 3) {
    parts.push(r.offers.answered / r.offers.sent);
    relFacts.push(`answered ${r.offers.answered} of ${r.offers.sent} offers`);
  }
  const reliability: Layer = parts.length ? { score: clamp((100 * parts.reduce((a, b) => a + b, 0)) / parts.length), facts: relFacts } : { score: null, facts: ["fewer than 3 shifts or offers to judge by"] };

  // Quality: what the homes said.
  const signed = clocked.filter((s) => s.timesheet!.clientAuthAt).length;
  const disputed = clocked.filter((s) => s.timesheet!.status === "DISPUTED" || s.timesheet!.status === "REJECTED").length;
  const upheld = r.complaints.filter((c) => c.status !== "DISMISSED");
  const weight = upheld.reduce((w, c) => w + ({ LOW: 5, MEDIUM: 10, HIGH: 20, CRITICAL: 40 }[c.severity] ?? 10), 0);
  const quality: Layer =
    clocked.length < 3 && upheld.length === 0
      ? { score: null, facts: ["fewer than 3 timesheets to judge by"] }
      : {
          score: clamp((clocked.length ? (100 * signed) / clocked.length : 100) - 20 * disputed - weight),
          facts: [
            ...(clocked.length ? [`homes signed off ${signed} of ${clocked.length} timesheets`] : []),
            ...(disputed ? [`${disputed} timesheet${disputed === 1 ? "" : "s"} disputed or rejected`] : []),
            upheld.length ? `${upheld.length} complaint${upheld.length === 1 ? "" : "s"} not dismissed` : "no complaints",
          ],
        };

  const layers = { competence, readiness, reliability, quality };
  const scored = LAYERS.filter((l) => layers[l.key].score !== null);
  const index = scored.length >= 2 && due.length >= 3 ? Math.round(scored.reduce((sum, l) => sum + layers[l.key].score! * l.weight, 0) / scored.reduce((w, l) => w + l.weight, 0)) : null;
  // One weak layer can't be averaged away: any layer under 50 caps the band at Watch.
  const weak = LAYERS.filter((l) => layers[l.key].score !== null && layers[l.key].score! < 50).map((l) => l.label);
  const byIndex: Band = index === null ? "new" : index >= 85 ? "excellent" : index >= 70 ? "good" : index >= 50 ? "watch" : "support";
  const band: Band = gaps.length ? "blocked" : weak.length && (byIndex === "excellent" || byIndex === "good") ? "watch" : byIndex;

  return { staffId: r.staffId, name: r.name, jobTitle: r.jobTitle, gate: { clear: gaps.length === 0, gaps, dueSoon }, layers, index, band, weak };
}

/** Every active carer in the agency, scored. */
export async function qualifiers(agencyId: string, now = new Date()): Promise<Qualifier[]> {
  const since = new Date(now.getTime() - WINDOW_DAYS * DAY);
  const ahead = new Date(now.getTime() + 7 * DAY);
  const staff = await prisma.staffProfile.findMany({
    where: { agencyId, status: "ACTIVE" },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      jobTitle: true,
      dbsNumber: true,
      dbsExpiry: true,
      rightToWork: { select: { status: true, expiryDate: true } },
      trainingRecords: { select: { courseName: true, expiryDate: true, status: true } },
      shifts: {
        where: { startAt: { gte: since, lt: ahead } },
        select: { startAt: true, endAt: true, breakMins: true, status: true, timesheet: { select: { clockIn: true, status: true, clientAuthAt: true } } },
      },
      shiftOffers: { where: { offeredAt: { gte: since } }, select: { respondedAt: true } },
      complaints: { where: { createdAt: { gte: since } }, select: { severity: true, status: true } },
    },
    orderBy: { lastName: "asc" },
  });
  return staff.map((s) =>
    score(
      {
        staffId: s.id,
        name: `${s.firstName} ${s.lastName}`.trim(),
        jobTitle: s.jobTitle,
        compliance: { dbsNumber: s.dbsNumber, dbsExpiry: s.dbsExpiry, rightToWork: s.rightToWork },
        training: s.trainingRecords,
        shifts: s.shifts,
        offers: { sent: s.shiftOffers.length, answered: s.shiftOffers.filter((o) => o.respondedAt).length },
        complaints: s.complaints,
      },
      now,
    ),
  );
}

/** The agency's index: the average over carers who have one, and how many are in each band. */
export function summarise(all: Qualifier[]) {
  const scored = all.filter((q) => q.index !== null && q.band !== "blocked");
  const counts = Object.fromEntries((Object.keys(BANDS) as Band[]).map((b) => [b, all.filter((q) => q.band === b).length])) as Record<Band, number>;
  return {
    index: scored.length ? Math.round(scored.reduce((s, q) => s + q.index!, 0) / scored.length) : null,
    counts,
    toReview: all.filter((q) => q.band === "blocked" || q.band === "support" || q.band === "watch"),
    total: all.length,
  };
}
