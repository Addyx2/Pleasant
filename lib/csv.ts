/**
 * Minimal RFC 4180 CSV reader.
 *
 * Deliberately dependency-free and forgiving about the things real
 * spreadsheets do: BOM, CRLF, blank lines, trailing commas and
 * inconsistent header casing. Nothing here talks to the database, so
 * the import wizard can preview a file before anything is written.
 */

export type ParsedCsv = {
  headers: string[];
  rows: string[][];
};

export function parseCsv(input: string): ParsedCsv {
  const text = (input ?? "").replace(/^\uFEFF/, "");
  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      record.push(field);
      field = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      record.push(field);
      field = "";
      if (record.some((cell) => cell.trim() !== "")) records.push(record);
      record = [];
      continue;
    }

    field += char;
  }

  if (field !== "" || record.length > 0) {
    record.push(field);
    if (record.some((cell) => cell.trim() !== "")) records.push(record);
  }

  if (records.length === 0) return { headers: [], rows: [] };

  const headers = records[0].map((h) => h.trim());
  const rows = records.slice(1).map((r) => {
    // Pad short rows and drop overflow so every row lines up with the headers.
    const padded = [...r];
    while (padded.length < headers.length) padded.push("");
    return padded.slice(0, headers.length);
  });

  return { headers, rows };
}

export function normalizeHeader(value: string): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s_\-.]+/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function rowToRecord(
  headers: string[],
  row: string[],
): Record<string, string> {
  const out: Record<string, string> = {};
  headers.forEach((header, index) => {
    out[normalizeHeader(header)] = (row[index] ?? "").trim();
  });
  return out;
}

/** Read the first matching field from a row, trying each alias in turn. */
export function pick(
  record: Record<string, string>,
  aliases: string[],
): string {
  for (const alias of aliases) {
    const value = record[normalizeHeader(alias)];
    if (value !== undefined && value !== "") return value;
  }
  return "";
}

export function parseMoney(value: string): number | null {
  const cleaned = (value ?? "")
    .replace(/[£$€\s]/g, "")
    .replace(/,(?=\d{3}\b)/g, "")
    .replace(/[^0-9.\-]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

const UK_DATE_FORMATS: { regex: RegExp; build: (m: RegExpMatchArray) => Date }[] = [
  {
    // DD/MM/YYYY — UK default, and not interchangeable with MM/DD.
    regex: /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/,
    build: (m) => new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
  },
  {
    regex: /^(\d{1,2})-(\d{1,2})-(\d{4})$/,
    build: (m) => new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])),
  },
  {
    // ISO YYYY-MM-DD, optionally with a time.
    regex: /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/,
    build: (m) =>
      new Date(
        Number(m[1]),
        Number(m[2]) - 1,
        Number(m[3]),
        m[4] ? Number(m[4]) : 0,
        m[5] ? Number(m[5]) : 0,
      ),
  },
];

export function parseDate(value: string): Date | null {
  const raw = (value ?? "").trim();
  if (!raw) return null;
  for (const format of UK_DATE_FORMATS) {
    const match = format.regex.exec(raw);
    if (match) {
      const date = format.build(match);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

/** Parse "22:30", "22:30:00" or a date with an embedded time. */
export function parseTimeToMinutes(value: string): number | null {
  const match = /(\d{1,2}):(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}
