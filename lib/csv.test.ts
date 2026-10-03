import assert from "node:assert/strict";
import { test } from "node:test";

import { normalizeHeader, parseCsv, parseDate, parseMoney, parseTimeToMinutes, pick, rowToRecord } from "./csv";

test("parseCsv reads a simple file", () => {
  const { headers, rows } = parseCsv("a,b\n1,2\n3,4");
  assert.deepEqual(headers, ["a", "b"]);
  assert.deepEqual(rows, [["1", "2"], ["3", "4"]]);
});

test("parseCsv handles quoted fields with commas, quotes and newlines", () => {
  const { headers, rows } = parseCsv('name,note\n"Doe, Jane","said ""no"""\n"multi\nline",x');
  assert.deepEqual(headers, ["name", "note"]);
  assert.equal(rows[0][0], "Doe, Jane");
  assert.equal(rows[0][1], 'said "no"');
  assert.equal(rows[1][0], "multi\nline");
  assert.equal(rows[1][1], "x");
});

test("parseCsv strips a UTF-8 BOM from the first header", () => {
  const { headers } = parseCsv("\uFEFFname,email");
  assert.equal(headers[0], "name");
});

test("parseCsv handles CRLF line endings and skips blank lines", () => {
  const { headers, rows } = parseCsv("a,b\r\n1,2\r\n\r\n3,4\r\n");
  assert.deepEqual(headers, ["a", "b"]);
  assert.equal(rows.length, 2);
});

test("parseCsv pads short rows and truncates long ones to the header count", () => {
  const { rows } = parseCsv("a,b,c\n1,2\n1,2,3,4");
  assert.deepEqual(rows[0], ["1", "2", ""]);
  assert.deepEqual(rows[1], ["1", "2", "3"]);
});

test("parseCsv returns nothing for an empty or blank-only file", () => {
  assert.deepEqual(parseCsv(""), { headers: [], rows: [] });
  assert.deepEqual(parseCsv("\n\n  \n"), { headers: [], rows: [] });
});

test("normalizeHeader ignores case, spaces, underscores and punctuation", () => {
  assert.equal(normalizeHeader("First Name"), "firstname");
  assert.equal(normalizeHeader("sort-code"), "sortcode");
  assert.equal(normalizeHeader("VAT_Number"), "vatnumber");
  assert.equal(normalizeHeader("Post Code (Eircode)"), "postcodeeircode");
});

test("rowToRecord maps each column by its normalised header", () => {
  const record = rowToRecord(["First Name", "Start_Time"], ["Ada", "07:00"]);
  assert.deepEqual(record, { firstname: "Ada", starttime: "07:00" });
});

test("pick finds a value under any alias, in priority order", () => {
  const record = { firstname: "Ada", givenname: "Augusta", lastname: "Lovelace" };
  assert.equal(pick(record, ["firstName", "givenName"]), "Ada");
  assert.equal(pick(record, ["givenName", "firstName"]), "Augusta");
  assert.equal(pick(record, ["missing"]), "");
});

test("parseMoney strips currency symbols and thousands separators", () => {
  assert.equal(parseMoney("£1,250.50"), 1250.5);
  assert.equal(parseMoney("12.71"), 12.71);
  assert.equal(parseMoney(" 0 "), 0);
  assert.equal(parseMoney("abc"), null);
  assert.equal(parseMoney(""), null);
});

test("parseDate reads UK day-first dates unambiguously", () => {
  const d = parseDate("09/03/2026");
  assert.equal(d?.getFullYear(), 2026);
  assert.equal(d?.getMonth(), 2);
  assert.equal(d?.getDate(), 9);
});

test("parseDate reads ISO dates and optional times", () => {
  const d = parseDate("2026-03-09T22:30");
  assert.equal(d?.getDate(), 9);
  assert.equal(d?.getHours(), 22);
  assert.equal(d?.getMinutes(), 30);
});

test("parseDate rejects nonsense", () => {
  assert.equal(parseDate("not a date"), null);
  assert.equal(parseDate(""), null);
});

test("parseTimeToMinutes reads clock times and rejects out-of-range", () => {
  assert.equal(parseTimeToMinutes("22:30"), 1350);
  assert.equal(parseTimeToMinutes("7:05"), 425);
  assert.equal(parseTimeToMinutes("2026-03-09 22:30:00"), 1350);
  assert.equal(parseTimeToMinutes("25:00"), null);
  assert.equal(parseTimeToMinutes(""), null);
});
