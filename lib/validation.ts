import { z } from "zod";

export const shiftStatuses = [
  "DRAFT",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
  "NO_SHOW",
] as const;

export const staffStatuses = ["ACTIVE", "INACTIVE", "ON_LEAVE"] as const;
export const clientStatuses = ["ACTIVE", "PAUSED", "DISCHARGED"] as const;
export const timesheetStatuses = ["PENDING", "APPROVED", "REJECTED", "DISPUTED"] as const;
export const studentLoanPlans = ["NONE", "PLAN_1", "PLAN_2", "PLAN_4", "PLAN_5", "POSTGRAD"] as const;

const optionalString = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

export const createShiftSchema = z.object({
  title: z.string().trim().min(2, "Give the shift a title"),
  role: z.string().trim().min(2, "Role is required"),
  clientId: optionalString,
  siteId: optionalString,
  staffId: optionalString,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  breakMins: z.coerce.number().int().min(0).max(480).default(0),
  chargeRate: z.coerce.number().min(0).default(0),
  isSleepIn: z.coerce.boolean().default(false),
  sleepInRate: z.coerce.number().min(0).default(0),
  notes: optionalString,
});

export const assignShiftSchema = z.object({
  shiftId: z.string().min(1),
  staffId: z.string().min(1),
});

export const clockSchema = z.object({
  shiftId: z.string().min(1),
  breakMins: z.coerce.number().int().min(0).max(480).default(0),
});

export const timesheetDecisionSchema = z.object({
  timesheetId: z.string().min(1),
  decision: z.enum(["APPROVED", "REJECTED", "DISPUTED"]),
});

export const createStaffSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  email: z.string().trim().email().optional().or(z.literal("")).transform((v) => (v ? v : undefined)),
  phone: optionalString,
  jobTitle: z.string().trim().min(2, "Job title is required"),
  band: optionalString,
  niNumber: optionalString,
  engagementType: z.enum(["PAYE", "LTD"]).default("PAYE"),
  ltdCompanyName: optionalString,
  taxCode: z.string().trim().default("1257L"),
  studentLoanPlan: z.enum(studentLoanPlans).default("NONE"),
  baseRate: z.coerce.number().min(0).default(0),
  nightRate: z.coerce.number().min(0).optional(),
  weekendRate: z.coerce.number().min(0).optional(),
  bankHolidayRate: z.coerce.number().min(0).optional(),
  holidayAccrualPct: z.coerce.number().min(0).max(100).default(12.07),
  pensionEnrolled: z.coerce.boolean().default(true),
  pensionEmployeePct: z.coerce.number().min(0).max(100).default(5),
  pensionEmployerPct: z.coerce.number().min(0).max(100).default(3),
});

export const createClientSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  address: optionalString,
  postcode: optionalString,
  phone: optionalString,
  careLevel: optionalString,
  notes: optionalString,
});

export const createSiteSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  address: optionalString,
  postcode: optionalString,
});

export const payrollRunSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
  period: z.enum(["WEEKLY", "FORTNIGHTLY", "FOUR_WEEKLY", "MONTHLY"]).default("WEEKLY"),
  reference: z.string().trim().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

export const onboardingAgencySchema = z.object({
  agencyName: z.string().trim().min(2, "Agency name is required"),
  firstName: z.string().trim().min(1, "Your first name is required"),
  lastName: z.string().trim().min(1, "Your last name is required"),
  email: z.string().trim().email("Enter a valid work email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

export const signOffSchema = z.object({
  timesheetId: z.string().min(1),
  signature: z.string().startsWith("data:image/", "A signature is required"),
});

export const clientAuthSchema = signOffSchema.extend({
  name: z.string().trim().min(1, "Signatory name is required"),
  position: z.string().trim().min(1, "Position is required"),
});

export const expensesSchema = z.object({
  timesheetId: z.string().min(1),
  expenses: z.coerce.number().min(0).max(100000),
  expenseNotes: z.string().trim().max(500).optional().transform((v) => (v ? v : undefined)),
});
