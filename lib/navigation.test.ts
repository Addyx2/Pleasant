import assert from "node:assert/strict";
import { test } from "node:test";

import { activeHref, navForRole, quickActionsForRole } from "./navigation";

const hrefs = ["/shifts", "/shifts/calendar", "/staff"];

test("activeHref picks the most specific match", () => {
  assert.equal(activeHref("/shifts/calendar", hrefs), "/shifts/calendar");
  assert.equal(activeHref("/shifts/abc123", hrefs), "/shifts");
  assert.equal(activeHref("/staff/new", hrefs), "/staff");
  assert.equal(activeHref("/staffing", hrefs), null);
});

test("managers don't see finance or workspace admin in navigation", () => {
  const labels = navForRole("MANAGER").sections.flatMap((s) => s.items.map((i) => i.href));
  assert.ok(labels.includes("/shifts"));
  assert.ok(!labels.includes("/payroll"));
  assert.ok(!labels.includes("/settings"));
  assert.ok(!quickActionsForRole("MANAGER").some((a) => a.href.startsWith("/settings")));
});

test("sections have unique keys and icons, and features are listed as text", () => {
  const { sections } = navForRole("ADMIN");
  const keys = sections.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["Shifts", "People", "Clientpointe", "Finance", "Persona"],
  );
  for (const s of sections) {
    assert.ok(s.icon, `${s.title} has no icon`);
    assert.ok(s.items.every((i) => !i.icon), `${s.title} lists a feature with an icon`);
  }
});

test("workspace lives in the account menu and is admin-only", () => {
  assert.deepEqual(navForRole("ADMIN").workspace.map((i) => i.href), ["/settings", "/import", "/addons"]);
  assert.deepEqual(navForRole("MANAGER").workspace, []);
});
