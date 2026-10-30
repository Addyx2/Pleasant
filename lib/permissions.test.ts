import assert from "node:assert/strict";
import { test } from "node:test";

import { canAccess, isOpsRole } from "./permissions";

test("admins reach every back-office route", () => {
  for (const href of ["/qualifiers", "/payroll", "/billing/abc", "/settings/team", "/shifts"]) {
    assert.equal(canAccess("ADMIN", href), true, href);
  }
});

test("managers reach operations but not money or account control", () => {
  assert.equal(canAccess("MANAGER", "/shifts"), true);
  assert.equal(canAccess("MANAGER", "/timesheets/sheet"), true);
  assert.equal(canAccess("MANAGER", "/compliance"), true);
  assert.equal(canAccess("MANAGER", "/payroll"), false);
  assert.equal(canAccess("MANAGER", "/payroll/run1/export"), false);
  assert.equal(canAccess("MANAGER", "/billing"), false);
  assert.equal(canAccess("MANAGER", "/settings/team"), false);
  assert.equal(canAccess("MANAGER", "/import"), false);
});

test("prefix matching does not over-match sibling routes", () => {
  assert.equal(canAccess("MANAGER", "/billingham-site"), true);
});

test("carers have no back-office access", () => {
  assert.equal(isOpsRole("STAFF"), false);
  assert.equal(canAccess("STAFF", "/shifts"), false);
});
