"use server";

import { cookies } from "next/headers";
import { z } from "zod";

import { SESSION_COOKIE, createSessionToken, getSessionUser, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { onboardingAgencySchema } from "@/lib/validation";

export interface CreateAgencyState {
  ok?: boolean;
  error?: string;
  values?: {
    agencyName: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export async function createAgencyAction(
  _prev: CreateAgencyState,
  formData: FormData,
): Promise<CreateAgencyState> {
  const parsed = onboardingAgencySchema.safeParse({
    agencyName: formData.get("agencyName"),
    firstName: formData.get("firstName"),
    lastName: formData.get("lastName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Check the details and try again",
      values: Object.fromEntries(formData.entries()) as CreateAgencyState["values"],
    };
  }

  const email = parsed.data.email.toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return {
      error: "An account with this email already exists",
      values: {
        agencyName: parsed.data.agencyName,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email,
      },
    };
  }

  const baseSlug = parsed.data.agencyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "agency";

  let slug = baseSlug;
  let suffix = 2;
  while (await prisma.agency.findUnique({ where: { slug } })) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const passwordHash = await hashPassword(parsed.data.password);

  const user = await prisma.$transaction(async (tx) => {
    const agency = await tx.agency.create({
      data: { name: parsed.data.agencyName, slug },
    });
    return tx.user.create({
      data: {
        agencyId: agency.id,
        email,
        passwordHash,
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        role: "ADMIN",
      },
    });
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, createSessionToken(user.id), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });

  return { ok: true };
}

const HEADER_ALIASES: Record<string, string> = {
  first: "firstName",
  firstname: "firstName",
  firstName: "firstName",
  last: "lastName",
  lastname: "lastName",
  lastName: "lastName",
  surname: "lastName",
  email: "email",
  "email address": "email",
  role: "jobTitle",
  jobtitle: "jobTitle",
  "job title": "jobTitle",
  jobTitle: "jobTitle",
  rate: "baseRate",
  baserate: "baseRate",
  baseRate: "baseRate",
  "hourly rate": "baseRate",
  "pay rate": "baseRate",
  ni: "niNumber",
  ninumber: "niNumber",
  niNumber: "niNumber",
  "national insurance": "niNumber",
  taxcode: "taxCode",
  taxCode: "taxCode",
  band: "band",
  night: "nightRate",
  nightrate: "nightRate",
  nightRate: "nightRate",
  weekend: "weekendRate",
  weekendrate: "weekendRate",
  weekendRate: "weekendRate",
};

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.trim() !== "")) rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }

  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((cell) => cell.trim() !== "")) rows.push(row);
  }
  return rows;
}

const staffRowSchema = z.object({
  firstName: z.string().trim().min(1, "First name is missing"),
  lastName: z.string().trim().min(1, "Last name is missing"),
  email: z
    .string()
    .trim()
    .email("Email is invalid")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  jobTitle: z.string().trim().min(2, "Missing or too-short job title"),
  baseRate: z.coerce.number({ invalid_type_error: "Rate must be a number" }).min(0).default(0),
  niNumber: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  band: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  taxCode: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : undefined)),
  nightRate: z.coerce.number({ invalid_type_error: "Night rate must be a number" }).min(0).optional(),
  weekendRate: z.coerce.number({ invalid_type_error: "Weekend rate must be a number" }).min(0).optional(),
});

export interface ImportStaffState {
  ok?: boolean;
  imported?: number;
  errors?: { line: number; message: string }[];
}

export async function importStaffAction(
  _prev: ImportStaffState,
  formData: FormData,
): Promise<ImportStaffState> {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return { ok: false, imported: 0, errors: [{ line: 0, message: "Session expired — sign in again" }] };
  }

  const raw = String(formData.get("csv") ?? "").trim();
  if (!raw) return { ok: false, imported: 0, errors: [{ line: 0, message: "Paste your staff list first" }] };

  const cells = parseCsv(raw);
  if (cells.length === 0) {
    return { ok: false, imported: 0, errors: [{ line: 0, message: "No rows found in the pasted text" }] };
  }

  const headerRow = cells[0].map((cell) => cell.trim().toLowerCase());
  const columnIndex: Record<string, number> = {};
  headerRow.forEach((cell, index) => {
    const canonical = HEADER_ALIASES[cell];
    if (canonical && columnIndex[canonical] === undefined) columnIndex[canonical] = index;
  });

  if (columnIndex.firstName === undefined || columnIndex.lastName === undefined) {
    return {
      ok: false,
      imported: 0,
      errors: [{ line: 0, message: "Include a header row with firstName,lastName,email,role,rate" }],
    };
  }

  const dataRows = cells.slice(1).slice(0, 500);
  const rows: {
    firstName: string;
    lastName: string;
    email?: string;
    jobTitle: string;
    baseRate: number;
    niNumber?: string;
    band?: string;
    taxCode?: string;
    nightRate?: number;
    weekendRate?: number;
  }[] = [];
  const errors: { line: number; message: string }[] = [];

  dataRows.forEach((row, index) => {
    const line = index + 2;
    if (row.every((cell) => cell.trim() === "")) return;
    const get = (name: string) => (columnIndex[name] !== undefined ? row[columnIndex[name]] ?? "" : "");
    const parsed = staffRowSchema.safeParse({
      firstName: get("firstName"),
      lastName: get("lastName"),
      email: get("email"),
      jobTitle: get("jobTitle") || "Carer",
      baseRate: get("baseRate") || "0",
      niNumber: get("niNumber"),
      band: get("band"),
      taxCode: get("taxCode"),
      nightRate: get("nightRate") || undefined,
      weekendRate: get("weekendRate") || undefined,
    });
    if (!parsed.success) {
      errors.push({ line, message: parsed.error.issues[0]?.message ?? "Invalid row" });
      return;
    }
    rows.push(parsed.data);
  });

  if (rows.length > 0) {
    await prisma.staffProfile.createMany({
      data: rows.map((row) => ({ ...row, agencyId: user.agencyId })),
    });
  }

  return { ok: true, imported: rows.length, errors: errors.slice(0, 20) };
}