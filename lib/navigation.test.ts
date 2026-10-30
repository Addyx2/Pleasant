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
  const labels = navForRole("MANAGER").pages.map((i) => i.href);
  assert.ok(labels.includes("/shifts"));
  assert.ok(!labels.includes("/payroll"));
  assert.ok(!labels.includes("/settings"));
  assert.ok(!quickActionsForRole("MANAGER").some((a) => a.href.startsWith("/settings")));
});

test("the sidebar is grouped Pleasant / Persona / Elements", () => {
  const admin = navForRole("ADMIN").groups;
  assert.deepEqual(admin.map((g) => g.label), ["Pleasant", "Persona", "Elements"]);
  assert.deepEqual(admin[1].links.map((l) => l.label), ["Overview", "Pushbots", "Assist", "Qualifiers"]);
  assert.deepEqual(admin[2].links.map((l) => l.label), ["Gateway", "Peak", "All Elements"]);
  // Managers use Gateway and Peak day to day; only admins switch Elements on and off.
  const manager = navForRole("MANAGER").groups;
  assert.deepEqual(manager.map((g) => g.label), ["Pleasant", "Persona", "Elements"]);
  assert.deepEqual(manager[2].links.map((l) => l.label), ["Gateway", "Peak"]);
  assert.deepEqual(navForRole("STAFF").groups, []);
});

test("sections have unique keys and icons, and features are listed as text", () => {
  const sections = navForRole("ADMIN").groups.flatMap((g) => g.sections);
  const keys = sections.map((s) => s.key);
  assert.equal(new Set(keys).size, keys.length);
  assert.deepEqual(
    sections.map((s) => s.title),
    ["Shifts", "People", "Supply", "Finance"],
  );
  for (const s of sections) {
    assert.ok(s.icon, `${s.title} has no icon`);
    assert.ok(s.items.every((i) => !i.icon), `${s.title} lists a feature with an icon`);
  }
});

test("workspace lives in the account menu and is admin-only", () => {
  assert.deepEqual(navForRole("ADMIN").workspace.map((i) => i.href), ["/settings", "/settings/integrations", "/import"]);
  assert.deepEqual(navForRole("MANAGER").workspace, []);
});
