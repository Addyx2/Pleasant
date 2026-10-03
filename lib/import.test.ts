import assert from "node:assert/strict";
import { test } from "node:test";

import { parseCsv } from "./csv";
import {
  missingColumns,
  previewImport,
  shiftEnd,
  toClientDraft,
  toShiftDraft,
  toWorkerDraft,
  validateRecord,
} from "./import";
import { rowToRecord } from "./csv";

function record(headers: string[], values: string[]) {
  return rowToRecord(headers, values);
}

test("missingColumns reports required headers that are absent", () => {
  const parsed = parseCsv("First Name,Address\nAda,1 High St");
  assert.deepEqual(missingColumns("clients", parsed), ["lastname"]);
  assert.deepEqual(missingColumns("workers", parsed), ["lastname", "jobtitle"]);
});

test("missingColumns is empty when required headers are present", () => {
  const parsed = parseCsv("First Name,Last Name,Job Title\nAda,Lovelace,Carer");
  assert.deepEqual(missingColumns("workers", parsed), []);
});

test("validateRecord requires a name for clients", () => {
  assert.equal(validateRecord("clients", record(["First Name", "Last Name"], ["", "Lovelace"])), "First name is missing");
  assert.equal(validateRecord("clients", record(["First Name", "Last Name"], ["Ada", ""])), "Last name is missing");
  assert.equal(validateRecord("clients", record(["First Name", "Last Name"], ["Ada", "Lovelace"])), null);
});

test("validateRecord requires a job title and numeric rate for workers", () => {
  assert.equal(
    validateRecord("workers", record(["First Name", "Last Name", "Job Title"], ["Ada", "L", ""])),
    "Job title is missing",
  );
  assert.equal(
    validateRecord("workers", record(["First Name", "Last Name", "Job Title", "Base Rate"], ["A", "L", "Carer", "abc"])),
    'Hourly rate "abc" is not a number',
  );
  assert.equal(
    validateRecord("workers", record(["First Name", "Last Name", "Job Title", "Base Rate"], ["A", "L", "Carer", "12.71"])),
    null,
  );
});

test("validateWorker accepts a blank rate and defaults it later", () => {
  assert.equal(validateRecord("workers", record(["First Name", "Last Name", "Job Title"], ["A", "L", "Carer"])), null);
});

test("validateRecord rejects an unreadable shift date", () => {
  const headers = ["Date", "Start", "End"];
  assert.equal(validateRecord("shifts", record(headers, ["", "07:00", "15:00"])), "Date is missing");
  assert.match(
    validateRecord("shifts", record(headers, ["9th March", "07:00", "15:00"])) ?? "",
    /not readable/,
  );
});

test("validateRecord rejects an end time before the start", () => {
  assert.equal(
    validateRecord("shifts", record(["Date", "Start", "End"], ["09/03/2026", "22:00", "07:00"])),
    "End time must be after the start time (overnight shifts aren't supported by import)",
  );
});

test("validateRecord rejects implausibly long shifts", () => {
  assert.match(
    validateRecord("shifts", record(["Date", "Start", "End"], ["09/03/2026", "06:00", "23:30"])) ?? "",
    /longer than 16 hours/,
  );
});

test("validateRecord accepts a normal shift", () => {
  assert.equal(validateRecord("shifts", record(["Date", "Start", "End"], ["09/03/2026", "07:00", "15:00"])), null);
});

test("previewImport counts valid and invalid rows and caps issues at 20", () => {
  const rows = Array.from({ length: 30 }, (_, i) =>
    i % 5 === 0 ? "Ada,Lovelace,Carer" : "Ada,,Carer",
  ).join("\n");
  const preview = previewImport("workers", parseCsv(`First Name,Last Name,Job Title\n${rows}`));

  assert.equal(preview.total, 30);
  assert.equal(preview.valid, 6);
  assert.equal(preview.invalid, 24);
  assert.equal(preview.issues.length, 20);
  assert.equal(preview.issues[0].line, 3);
});

test("previewImport surfaces missing required columns", () => {
  const preview = previewImport("clients", parseCsv("First Name\nAda"));
  assert.deepEqual(preview.missingColumns, ["lastname"]);
});

test("previewImport samples at most five valid rows", () => {
  const rows = Array.from({ length: 10 }, (_, i) => `Person${i},Surname,Carer`).join("\n");
  const preview = previewImport("workers", parseCsv(`First Name,Last Name,Job Title\n${rows}`));
  assert.equal(preview.valid, 10);
  assert.equal(preview.sample.length, 5);
  assert.equal(preview.sample[0].summary, "Person0 Surname");
});

test("toClientDraft maps billing fields and drops a malformed email", () => {
  const draft = toClientDraft(
    record(
      ["First Name", "Last Name", "Email", "Company", "VAT Number", "Post Code"],
      ["Ada", "Lovelace", "ada@example.com", "Meadow View", "GB123456789", "SW1A 1AA"],
    ),
  );
  assert.equal(draft.email, "ada@example.com");
  assert.equal(draft.companyName, "Meadow View");
  assert.equal(draft.vatNumber, "GB123456789");
  assert.equal(draft.postcode, "SW1A 1AA");

  const bad = toClientDraft(record(["First Name", "Last Name", "Email"], ["A", "B", "not-an-email"]));
  assert.equal(bad.email, null);
});

test("toWorkerDraft parses rates, engagement type and DBS dates", () => {
  const draft = toWorkerDraft(
    record(
      ["First Name", "Last Name", "Job Title", "Base Rate", "Engagement", "DBS Expiry", "Sort Code", "Account Number"],
      ["Ada", "Lovelace", "Senior Carer", "£13.40", "LTD", "12/06/2027", "20-00-00", "12345678"],
    ),
  );
  assert.equal(draft.baseRate, 13.4);
  assert.equal(draft.engagementType, "LTD");
  assert.equal(draft.dbsExpiry?.getFullYear(), 2027);
  assert.equal(draft.sortCode, "20-00-00");
});

test("toWorkerDraft defaults engagement to PAYE and rate to zero", () => {
  const draft = toWorkerDraft(record(["First Name", "Last Name", "Job Title"], ["Ada", "L", "Carer"]));
  assert.equal(draft.engagementType, "PAYE");
  assert.equal(draft.baseRate, 0);
});

test("toShiftDraft converts times onto the parsed date and computes the end", () => {
  const draft = toShiftDraft(
    record(["Date", "Start", "End", "Title", "Role", "Client", "Carer"], ["09/03/2026", "07:00", "15:00", "Day shift", "Care Assistant", "Meadow View", "Ada"]),
  );
  assert.ok(draft);
  assert.equal(draft?.date.getDate(), 9);
  assert.equal(draft?.date.getHours(), 7);
  assert.equal(shiftEnd(draft!).getHours(), 15);
  assert.equal(draft?.clientName, "Meadow View");
  assert.equal(draft?.staffName, "Ada");
});

test("toShiftDraft returns null for an unparseable row", () => {
  assert.equal(toShiftDraft(record(["Date", "Start", "End"], ["nope", "07:00", "15:00"])), null);
});
