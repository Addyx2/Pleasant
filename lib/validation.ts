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
  title: optionalString,
  role: z.string().trim().min(2, "Role is required"),
  clientId: optionalString,
  siteId: optionalString,
  staffId: optionalString,
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  breakMins: z.coerce.number().int().min(0).max(480).default(0),
  // Blank means "use the client's rate card".
  chargeRate: z.coerce.number().min(0).optional(),
  isSleepIn: z.coerce.boolean().default(false),
  sleepInRate: z.coerce.number().min(0).default(0),
  // Blank means "use the rate card", or bill the allowance if the card has none.
  sleepInCharge: z.coerce.number().min(0).optional(),
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
  bankName: optionalString,
  accountName: optionalString,
  sortCode: optionalString,
  bankAcct: optionalString,
  dbsNumber: optionalString,
  dbsExpiry: z.string().trim().optional().transform((v) => (v ? new Date(v) : undefined)),
});

const optionalEmail = z
  .string()
  .trim()
  .email("Enter a valid email")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

const optionalMoney = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? Number(v) : undefined))
  .refine((v) => v === undefined || (Number.isFinite(v) && v >= 0 && v < 10_000), "Enter a valid rate");

export const clientSchema = z.object({
  name: z.string().trim().min(2, "Enter the home or provider's name").max(160),
  type: z.enum(["CARE_HOME", "NURSING_HOME", "DOMICILIARY_PROVIDER", "SUPPORTED_LIVING", "NHS", "LOCAL_AUTHORITY", "OTHER"]),
  address: optionalString,
  postcode: optionalString,
  phone: optionalString,
  email: optionalEmail,
  vatNumber: optionalString,
  companyNo: optionalString,
  cqcLocationId: optionalString,
  frameworkRef: optionalString,
  paymentTermsDays: z.coerce.number().int().min(0, "Terms can't be negative").max(180).default(30),
  status: z.enum(clientStatuses).default("ACTIVE"),
  notes: optionalString,
});

export const createSiteSchema = z.object({
  clientId: z.string().min(1, "Choose a client"),
  name: z.string().trim().min(1, "Name is required"),
  address: optionalString,
  postcode: optionalString,
  notes: optionalString,
});

export const clientContactSchema = z.object({
  clientId: z.string().min(1),
  name: z.string().trim().min(2, "Enter the contact's name").max(120),
  jobTitle: optionalString,
  email: optionalEmail,
  phone: optionalString,
  isSignatory: z.boolean(),
  isAccounts: z.boolean(),
});

export const clientRateSchema = z.object({
  clientId: z.string().min(1),
  siteId: optionalString,
  role: z.string().trim().min(2, "Enter a role, e.g. Care Assistant").max(80),
  dayRate: z.coerce.number().positive("Enter the day rate").max(10_000),
  nightRate: optionalMoney,
  weekendRate: optionalMoney,
  bankHolidayRate: optionalMoney,
  sleepInCharge: optionalMoney,
});

export const payrollRunSchema = z.object({
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  payDate: z.coerce.date(),
  period: z.enum(["WEEKLY", "FORTNIGHTLY", "FOUR_WEEKLY", "MONTHLY"]).default("WEEKLY"),
  reference: z.string().trim().optional(),
});

export const createInvoiceSchema = z.object({
  clientId: z.string().min(1, "Choose a client to bill"),
  periodStart: z.coerce.date(),
  periodEnd: z.coerce.date(),
  dueDate: z.coerce.date(),
  vatRatePct: z.coerce.number().min(0).max(20).default(0),
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
