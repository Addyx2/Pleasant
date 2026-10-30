import { z } from "zod";

// The contract between Pleasant and Aultrum ID for Carer API v1 (the Aultrum
// app) and Supply API v1 (Aultrum Workspace). This file is mirrored, byte for
// byte, at lib/contracts/aultrum-v1.ts in aultrum-id: Pleasant's tests check
// that what it sends parses, and Aultrum ID's tests check that its screens
// read exactly these shapes. Change both copies together, and only by adding
// fields: a deployed app may be one version behind the other.
//
// Dates are ISO strings; money is pounds.

const iso = z.string().datetime({ offset: true });
const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nullableIso = iso.nullable();

// Carer API v1

export const shiftCard = z.object({
  id: z.string(),
  title: z.string(),
  place: z.string(),
  detail: z.string(),
  startAt: iso,
  endAt: iso,
  day,
  night: z.boolean(),
  weekend: z.boolean(),
  sleepIn: z.boolean(),
  pay: z.object({ rate: z.number().nullable(), total: z.number().nullable(), hours: z.number() }),
});

export const heroShift = shiftCard.extend({
  state: z.enum(["on_shift", "on_break", "to_sign", "starting", "next"]),
  address: z.string().nullable(),
  mapsQuery: z.string().nullable(),
  siteNotes: z.string().nullable(),
  notes: z.string().nullable(),
  timesheet: z
    .object({
      id: z.string(),
      clockIn: iso,
      clockOut: nullableIso,
      breakStartedAt: nullableIso,
      breakTakenMins: z.number(),
      workedMins: z.number(),
      locationRecorded: z.boolean(),
      carerSigned: z.boolean(),
      clientSigned: z.boolean(),
      homeSignsInWorkspace: z.boolean(),
    })
    .nullable(),
});

export const homeScreen = z.object({
  firstName: z.string(),
  org: z.string(),
  current: heroShift.nullable(),
  offers: z.array(z.object({ id: z.string(), shift: shiftCard })),
  toSign: z.array(shiftCard.extend({ timesheetId: z.string(), needs: z.enum(["yours", "theirs"]), homeSignsInWorkspace: z.boolean() })),
  upcoming: z.array(shiftCard),
  payCutoff: iso,
  payDay: iso,
});

export const poolScreen = z.object({
  org: z.string(),
  shifts: z.array(shiftCard.extend({ request: z.enum(["PENDING", "ACCEPTED", "REJECTED"]).nullable(), unavailable: z.boolean() })),
});

export const calendarScreen = z.object({
  org: z.string(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  today: day,
  shifts: z.array(shiftCard),
  requests: z.array(shiftCard),
  blockedDays: z.array(day),
  rules: z.array(z.object({ id: z.string(), startsOn: day, endsOn: day, weekday: z.number().int().nullable(), reason: z.string().nullable() })),
});

export const checkState = z.enum(["OK", "DUE_SOON", "EXPIRED", "MISSING"]);

export const passportScreen = z.object({
  org: z.string(),
  rows: z.array(
    z.object({
      group: z.enum(["statutory", "training"]),
      title: z.string(),
      detail: z.string().nullable(),
      state: checkState,
      expiresAt: nullableIso,
      daysLeft: z.number().nullable(),
    }),
  ),
});

export const peakScreen = z.union([
  z.object({ org: z.string(), on: z.literal(false) }),
  z.object({ org: z.string(), on: z.literal(true), url: z.string().optional(), problem: z.string().optional() }),
]);

export const timesheetsScreen = z.object({
  org: z.string(),
  timesheets: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      place: z.string(),
      clockIn: iso,
      clockOut: iso,
      workedMins: z.number(),
      status: z.string(),
      stage: z.enum(["to_sign", "waiting", "signed", "closed"]),
      carerSigned: z.boolean(),
      homeSignsInWorkspace: z.boolean(),
      signedBy: z.string().nullable(),
      signedPosition: z.string().nullable(),
      signedAt: nullableIso,
      daysWaiting: z.number().nullable(),
    }),
  ),
});

/** Every action's answer, from either API. `go` is a page in the calling app to open next. */
export const actionResult = z.object({ ok: z.boolean().optional(), message: z.string().optional(), error: z.string().optional(), go: z.string().optional() });

// Supply API v1

export const supplyShift = z.object({
  id: z.string(),
  title: z.string(),
  role: z.string().nullable(),
  site: z.string().nullable(),
  startAt: iso,
  endAt: iso,
  status: z.string(),
  carer: z.string().nullable(),
  requested: z.boolean().optional(),
});

export const supplyOverview = z.object({
  agency: z.string(),
  client: z.string(),
  onSite: z.array(supplyShift),
  upcoming: z.array(supplyShift),
  toSign: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      carer: z.string().nullable(),
      clockIn: iso,
      clockOut: nullableIso,
      workedMins: z.number(),
      breakMins: z.number(),
      daysWaiting: z.number().nullable(),
      carerSigned: z.boolean(),
    }),
  ),
  roles: z.array(z.string()),
  invoices: z.array(
    z.object({
      id: z.string(),
      reference: z.string(),
      status: z.string(),
      periodStart: iso,
      periodEnd: iso,
      hours: z.number(),
      total: z.number(),
      dueDate: nullableIso,
    }),
  ),
});

export const supplyTimesheets = z.object({
  timesheets: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      site: z.string().nullable(),
      carer: z.string().nullable(),
      clockIn: iso,
      clockOut: nullableIso,
      workedMins: z.number(),
      breakMins: z.number(),
      carerSigned: z.boolean(),
      signed: z.boolean(),
      signedBy: z.string().nullable(),
      signedPosition: z.string().nullable(),
      signedAt: nullableIso,
      daysWaiting: z.number().nullable(),
    }),
  ),
});

/** Paths and the shape each GET answers with. */
export const carerScreens = { home: homeScreen, pool: poolScreen, calendar: calendarScreen, passport: passportScreen, peak: peakScreen, timesheets: timesheetsScreen };
export const supplyReads = { overview: supplyOverview, timesheets: supplyTimesheets };
