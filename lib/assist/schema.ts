import { z } from "zod";

// Each Assist tool declares its inputs once with these helpers and gets both
// the JSON schema Claude sees and a Zod validator for what Claude sends back.
// Inputs are validated before any tool runs.

interface Field<Z extends z.ZodTypeAny = z.ZodTypeAny> {
  zod: Z;
  json: Record<string, unknown>;
  optional: boolean;
}

function field<Z extends z.ZodTypeAny>(zod: Z, json: Record<string, unknown>, description: string): Field<Z> {
  return { zod, json: { ...json, description }, optional: false };
}

export const str = (description: string, max = 200) =>
  field(z.string().trim().min(1).max(max), { type: "string" }, description);

export const id = (description: string) => field(z.string().trim().min(1).max(64), { type: "string" }, description);

export const num = (description: string, min = 0, max = 100_000) =>
  field(z.number().min(min).max(max), { type: "number", minimum: min, maximum: max }, description);

export const int = (description: string, min = 0, max = 10_000) =>
  field(z.number().int().min(min).max(max), { type: "integer", minimum: min, maximum: max }, description);

export const bool = (description: string) => field(z.boolean(), { type: "boolean" }, description);

export const oneOf = <const T extends readonly [string, ...string[]]>(values: T, description: string) =>
  field(z.enum(values as unknown as [T[number], ...T[number][]]), { type: "string", enum: values }, description);

export const date = (description: string) =>
  field(
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
    { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}$" },
    `${description} (YYYY-MM-DD)`,
  );

export const dateTime = (description: string) =>
  field(
    z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Use YYYY-MM-DDTHH:MM"),
    { type: "string", pattern: "^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}$" },
    `${description} (local UK time, YYYY-MM-DDTHH:MM)`,
  );

export const idList = (description: string, max = 20) =>
  field(
    z.array(z.string().trim().min(1).max(64)).min(1).max(max),
    { type: "array", items: { type: "string" }, minItems: 1, maxItems: max },
    description,
  );

export function optional<Z extends z.ZodTypeAny>(f: Field<Z>): Field<z.ZodOptional<Z>> {
  return { ...f, zod: f.zod.optional(), optional: true };
}

export function shape<S extends Record<string, Field>>(fields: S) {
  const zodShape = Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.zod])) as {
    [K in keyof S]: S[K]["zod"];
  };
  return {
    zod: z.object(zodShape).strict(),
    json: {
      type: "object" as const,
      properties: Object.fromEntries(Object.entries(fields).map(([k, f]) => [k, f.json])),
      required: Object.entries(fields)
        .filter(([, f]) => !f.optional)
        .map(([k]) => k),
      additionalProperties: false,
    },
  };
}
