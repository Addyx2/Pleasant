import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";
process.env.AULTRUM_ID_URL = "https://id.example";
process.env.AULTRUM_ID_CLIENT_ID = "aid_pleasant";

import { newSignIn, openCookie, sealCookie } from "./aultrum-id";

test("sealed cookies round-trip, expire, and are bound to their purpose", () => {
  const cookie = sealCookie("aid-state", { state: "s" }, 60_000, 1_000);
  assert.equal(openCookie<{ state: string }>("aid-state", cookie, 2_000)?.state, "s");
  assert.equal(openCookie("aid-link", cookie, 2_000), null);
  assert.equal(openCookie("aid-state", cookie, 62_000), null);
  const [data, sig] = cookie.split(".");
  assert.equal(openCookie("aid-state", `${data}A.${sig}`, 2_000), null);
});

test("newSignIn builds a PKCE authorization request", () => {
  const { pending, url } = newSignIn("https://pleasant.example/api/auth/aultrum/callback", "/billing");
  const u = new URL(url);
  assert.equal(u.origin + u.pathname, "https://id.example/authorize");
  assert.equal(u.searchParams.get("client_id"), "aid_pleasant");
  assert.equal(u.searchParams.get("code_challenge_method"), "S256");
  assert.equal(u.searchParams.get("code_challenge"), createHash("sha256").update(pending.verifier).digest("base64url"));
  assert.equal(u.searchParams.get("state"), pending.state);
  assert.equal(u.searchParams.get("nonce"), pending.nonce);
  assert.equal(pending.next, "/billing");
});
