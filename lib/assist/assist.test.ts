import assert from "node:assert/strict";
import { test } from "node:test";

import { redirectTarget, toFormData } from "./bridge";
import { date, num, oneOf, optional, shape, str } from "./schema";
import { ASSIST_TOOLS, findTool, toolsFor } from "./tools";

test("toFormData skips empty values and encodes checkboxes like a browser", () => {
  const form = toFormData({ a: "x", b: 2, on: true, off: false, none: undefined, nil: null });
  assert.equal(form.get("a"), "x");
  assert.equal(form.get("b"), "2");
  assert.equal(form.get("on"), "on");
  assert.equal(form.has("off"), false);
  assert.equal(form.has("none"), false);
  assert.equal(form.has("nil"), false);
});

test("redirectTarget reads where a server action redirected", () => {
  assert.equal(redirectTarget({ digest: "NEXT_REDIRECT;replace;/clients/abc;307;" }), "/clients/abc");
  assert.equal(redirectTarget({ digest: "NEXT_REDIRECT;push;/dispatch?tab=requests&result=taken;307;" }), "/dispatch?tab=requests&result=taken");
  assert.equal(redirectTarget(new Error("boom")), null);
  assert.equal(redirectTarget({ digest: "NEXT_NOT_FOUND" }), null);
});

test("shape builds a matching JSON schema and strict validator", () => {
  const s = shape({
    name: str("Name"),
    rate: optional(num("Rate", 0, 100)),
    when: date("Day"),
    kind: oneOf(["A", "B"], "Kind"),
  });
  assert.deepEqual(s.json.required, ["name", "when", "kind"]);
  assert.equal(s.json.additionalProperties, false);
  assert.equal(s.zod.safeParse({ name: "x", when: "2026-10-27", kind: "A" }).success, true);
  assert.equal(s.zod.safeParse({ name: "x", when: "27/10/2026", kind: "A" }).success, false);
  assert.equal(s.zod.safeParse({ name: "x", when: "2026-10-27", kind: "C" }).success, false);
  assert.equal(s.zod.safeParse({ name: "x", when: "2026-10-27", kind: "A", extra: 1 }).success, false);
  assert.equal(s.zod.safeParse({ name: "x", when: "2026-10-27", kind: "A", rate: 500 }).success, false);
});

test("tool names are unique and every change-making tool can describe itself", () => {
  const names = ASSIST_TOOLS.map((t) => t.name);
  assert.equal(new Set(names).size, names.length);
  for (const t of ASSIST_TOOLS) {
    assert.ok(t.description.length > 20, t.name);
    assert.ok(/^[a-z_]+$/.test(t.name), t.name);
    if (t.kind === "write") assert.ok(t.describe, `${t.name} needs describe() for its confirmation card`);
  }
});

test("managers get operations tools but never money or payroll tools", () => {
  const manager = toolsFor("MANAGER").map((t) => t.name);
  assert.ok(manager.includes("create_shift"));
  assert.ok(manager.includes("decide_timesheet"));
  for (const adminOnly of ["list_invoices", "create_invoice", "set_invoice_status", "list_payroll_runs", "generate_payroll_run", "set_payroll_status"]) {
    assert.ok(!manager.includes(adminOnly), adminOnly);
    assert.ok(findTool("ADMIN", adminOnly), adminOnly);
  }
  assert.equal(findTool("MANAGER", "create_invoice"), undefined);
});

test("carers get no Assist tools at all", () => {
  assert.equal(toolsFor("STAFF").length, 0);
});
