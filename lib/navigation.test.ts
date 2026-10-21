import assert from "node:assert/strict";
import { test } from "node:test";

import { activeHref, navForRole, quickActionsForRole } from "./navigation";

const hrefs = ["/shifts", "/shifts/requests", "/shifts/unattended", "/staff"];

test("activeHref picks the most specific match", () => {
  assert.equal(activeHref("/shifts/requests", hrefs), "/shifts/requests");
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
