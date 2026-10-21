import assert from "node:assert/strict";
import { test } from "node:test";

import { safeNextPath } from "./utils";

test("safeNextPath keeps same-origin paths", () => {
  assert.equal(safeNextPath("/shifts?week=2"), "/shifts?week=2");
  assert.equal(safeNextPath("/"), "/");
});

test("safeNextPath rejects off-site redirects", () => {
  assert.equal(safeNextPath("https://evil.com"), null);
  assert.equal(safeNextPath("//evil.com"), null);
  assert.equal(safeNextPath("/\\evil.com"), null);
  assert.equal(safeNextPath("/\tfoo"), null);
  assert.equal(safeNextPath(""), null);
  assert.equal(safeNextPath(undefined), null);
});
