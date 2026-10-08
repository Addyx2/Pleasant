import { parseDate, parseMoney, parseTimeToMinutes, pick, rowToRecord, type ParsedCsv } from "./csv";

export type ImportKind = "clients" | "workers" | "shifts";

export type ImportRowIssue = { line: number; message: string };

export type ImportPreview = {
  kind: ImportKind;
  headers: string[];
  total: number;
  valid: number;
  invalid: number;
  issues: ImportRowIssue[];
  sample: { line: number; summary: string }[];
  missingColumns: string[];
};

export type ClientDraft = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  postcode: string | null;
  careLevel: string | null;
  companyName: string | null;
  vatNumber: string | null;
};

export type WorkerDraft = {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string;
  niNumber: string | null;
  baseRate: number;
  engagementType: "PAYE" | "LTD";
  bankName: string | null;
  accountName: string | null;
  sortCode: string | null;
  bankAcct: string | null;
  dbsNumber: string | null;
  dbsExpiry: Date | null;
};

export type ShiftDraft = {
  date: Date;
  startMins: number;
  endMins: number;
  title: string;
  role: string;
  clientName: string | null;
  staffName: string | null;
  siteName: string | null;
};

const CLIENT_REQUIRED = ["firstname", "lastname"];
const WORKER_REQUIRED = ["firstname", "lastname", "jobtitle"];
const SHIFT_REQUIRED = ["date", "start", "end"];

function normalizeSet(headers: string[]): Set<string> {
  return new Set(headers.map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, "")));
}

function requiredFor(kind: ImportKind): string[] {
  if (kind === "clients") return CLIENT_REQUIRED;
  if (kind === "workers") return WORKER_REQUIRED;
  return SHIFT_REQUIRED;
}

export function missingColumns(kind: ImportKind, parsed: ParsedCsv): string[] {
  const present = normalizeSet(parsed.headers);
  return requiredFor(kind).filter((column) => !present.has(column));
}

function summarize(kind: ImportKind, record: Record<string, string>): string {
  if (kind === "shifts") {
    const date = pick(record, ["date", "shiftdate", "startdate"]);
    const start = pick(record, ["start", "starttime", "timestart"]);
    const title = pick(record, ["title", "shift", "shiftname", "name"]);
    return [date, start, title].filter(Boolean).join(" · ") || "(blank)";
  }
  const first = pick(record, ["firstname", "first", "forename", "givenname"]);
  const last = pick(record, ["lastname", "last", "surname", "familyname"]);
  return `${first} ${last}`.trim() || "(blank)";
}

export function previewImport(kind: ImportKind, parsed: ParsedCsv): ImportPreview {
  const required = requiredFor(kind);
  const present = normalizeSet(parsed.headers);
  const missing = required.filter((column) => !present.has(column));
  const issues: ImportRowIssue[] = [];
  const sample: { line: number; summary: string }[] = [];
  let valid = 0;

  parsed.rows.forEach((row, index) => {
    const line = index + 2; // 1-based, +1 for the header row
    const record = rowToRecord(parsed.headers, row);
    const problem = validateRecord(kind, record);
    if (problem) {
      issues.push({ line, message: problem });
      return;
    }
    valid += 1;
    if (sample.length < 5) sample.push({ line, summary: summarize(kind, record) });
  });

  return {
    kind,
    headers: parsed.headers,
    total: parsed.rows.length,
    valid,
    invalid: issues.length,
    issues: issues.slice(0, 20),
    sample,
    missingColumns: missing,
  };
}

export function validateRecord(kind: ImportKind, record: Record<string, string>): string | null {
  if (kind === "clients") {
    if (!pick(record, ["firstname", "first", "forename", "givenname"])) return "First name is missing";
    if (!pick(record, ["lastname", "last", "surname", "familyname"])) return "Last name is missing";
    return null;
  }

  if (kind === "workers") {
    if (!pick(record, ["firstname", "first", "forename", "givenname"])) return "First name is missing";
    if (!pick(record, ["lastname", "last", "surname", "familyname"])) return "Last name is missing";
    if (!pick(record, ["jobtitle", "role", "position", "title"])) return "Job title is missing";
    const rate = pick(record, ["baserate", "hourlyrate", "rate", "payrate"]);
    if (rate && parseMoney(rate) === null) return `Hourly rate "${rate}" is not a number`;
    return null;
  }

  const dateRaw = pick(record, ["date", "shiftdate", "startdate", "day"]);
  if (!dateRaw) return "Date is missing";
  const date = parseDate(dateRaw);
  if (!date) return `Date "${dateRaw}" is not readable (use DD/MM/YYYY)`;

  const startRaw = pick(record, ["start", "starttime", "timestart", "from"]);
  const endRaw = pick(record, ["end", "endtime", "timeend", "to"]);
  if (!startRaw || !endRaw) return "Start and end time are required";

  const startMins = parseTimeToMinutes(startRaw);
  const endMins = parseTimeToMinutes(endRaw);
  if (startMins === null) return `Start time "${startRaw}" is not readable (use HH:MM)`;
  if (endMins === null) return `End time "${endRaw}" is not readable (use HH:MM)`;
  if (startMins === endMins) return "Start and end times cannot be identical";
  // An end time before the start time means the shift runs into the next day
  // (shiftEnd rolls it forward), so measure it across midnight.
  const duration =
    endMins > startMins ? endMins - startMins : endMins + 24 * 60 - startMins;
  if (duration > 16 * 60) return "Shift is longer than 16 hours — check the times";

  return null;
}

function emailOrNull(value: string): string | null {
  const raw = value.trim();
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(raw) ? raw : null;
}

export function toClientDraft(record: Record<string, string>): ClientDraft {
  return {
    firstName: pick(record, ["firstname", "first", "forename", "givenname"]),
    lastName: pick(record, ["lastname", "last", "surname", "familyname"]),
    email: emailOrNull(pick(record, ["email", "emailaddress", "billingemail"])),
    phone: pick(record, ["phone", "telephone", "mobile", "contactnumber"]) || null,
    address: pick(record, ["address", "addressline1", "street"]) || null,
    postcode: pick(record, ["postcode", "postalcode", "zip"]) || null,
    careLevel: pick(record, ["carelevel", "level", "caretype"]) || null,
    companyName: pick(record, ["companyname", "company", "homename", "tradingname"]) || null,
    vatNumber: pick(record, ["vatnumber", "vat", "vatno"]) || null,
  };
}

export function toWorkerDraft(record: Record<string, string>): WorkerDraft {
  const engagement = pick(record, ["engagementtype", "engagement", "contracttype"]).toUpperCase();
  return {
    firstName: pick(record, ["firstname", "first", "forename", "givenname"]),
    lastName: pick(record, ["lastname", "last", "surname", "familyname"]),
    email: emailOrNull(pick(record, ["email", "emailaddress"])),
    phone: pick(record, ["phone", "telephone", "mobile", "contactnumber"]) || null,
    jobTitle: pick(record, ["jobtitle", "role", "position", "title"]),
    niNumber: pick(record, ["ninumber", "ni", "nationalinsurance"]) || null,
    baseRate: parseMoney(pick(record, ["baserate", "hourlyrate", "rate", "payrate"])) ?? 0,
    engagementType: engagement === "LTD" || engagement === "LTD COMPANY" ? "LTD" : "PAYE",
    bankName: pick(record, ["bankname", "bank"]) || null,
    accountName: pick(record, ["accountname", "accountholder", "nameonaccount"]) || null,
    sortCode: pick(record, ["sortcode", "sort"]) || null,
    bankAcct: pick(record, ["accountnumber", "bankaccount", "accountno", "acct"]) || null,
    dbsNumber: pick(record, ["dbsnumber", "dbs", "dbscertificate", "clearancenumber"]) || null,
    dbsExpiry: parseDate(pick(record, ["dbsexpiry", "dbsdate", "dbsexpirydate", "clearanceexpiry"])),
  };
}

export function toShiftDraft(record: Record<string, string>): ShiftDraft | null {
  const date = parseDate(pick(record, ["date", "shiftdate", "startdate", "day"]));
  const startMins = parseTimeToMinutes(pick(record, ["start", "starttime", "timestart", "from"]));
  const endMins = parseTimeToMinutes(pick(record, ["end", "endtime", "timeend", "to"]));
  if (!date || startMins === null || endMins === null) return null;
  date.setHours(Math.floor(startMins / 60), startMins % 60, 0, 0);
  return {
    date,
    startMins,
    endMins,
    title: pick(record, ["title", "shift", "shiftname", "name"]) || "Shift",
    role: pick(record, ["role", "position", "jobtitle"]) || "Care Assistant",
    clientName: pick(record, ["client", "clientname", "customer", "serviceuser"]) || null,
    staffName: pick(record, ["carer", "carername", "staff", "staffname", "worker"]) || null,
    siteName: pick(record, ["site", "sitename", "location", "home"]) || null,
  };
}

export function shiftEnd(draft: ShiftDraft): Date {
  const end = new Date(draft.date);
  end.setHours(Math.floor(draft.endMins / 60), draft.endMins % 60, 0, 0);
  // Overnight shift: end clock time is not after the start, so roll to tomorrow.
  if (end <= draft.date) end.setDate(end.getDate() + 1);
  return end;
}
