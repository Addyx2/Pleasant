import assert from "node:assert/strict";
import { test } from "node:test";

import { absoluteUrl } from "./url";

// Outside a request (Pushbots' emails, scheduled runs) there are no headers to read.

test("APP_URL wins, trailing slash or not", async () => {
  process.env.APP_URL = "https://pleasant.example.com/";
  assert.equal(await absoluteUrl("/shifts/abc"), "https://pleasant.example.com/shifts/abc");
  delete process.env.APP_URL;
});

test("outside a request, without APP_URL, links still get a full address", async () => {
  delete process.env.APP_URL;
  const url = await absoluteUrl("/shifts/abc");
  assert.match(url, /^https?:\/\/[^/]+\/shifts\/abc$/);
});
