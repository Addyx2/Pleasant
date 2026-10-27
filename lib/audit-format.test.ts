import assert from "node:assert/strict";
import { test } from "node:test";

import { auditCategoryLabel, isAuditCategory, isSensitiveAction } from "./audit-format";

test("audit categories derive from the action prefix", () => {
  assert.equal(auditCategoryLabel("payroll.status"), "Payroll");
  assert.equal(auditCategoryLabel("team.invite"), "Team");
  assert.equal(auditCategoryLabel("mystery.thing"), "mystery");
});

test("category filter only accepts known keys", () => {
  assert.equal(isAuditCategory("auth"), true);
  assert.equal(isAuditCategory("drop table"), false);
  assert.equal(isAuditCategory(undefined), false);
});

test("bank detail changes are flagged as sensitive", () => {
  assert.equal(isSensitiveAction("settings.bank_details"), true);
  assert.equal(isSensitiveAction("auth.login"), false);
});
