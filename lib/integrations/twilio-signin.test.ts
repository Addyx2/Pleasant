import assert from "node:assert/strict";
import { createServer } from "node:http";
import { test } from "node:test";

import { describeSignIn, twilioAccount } from "./twilio";

test("a refused sign-in is described without the secret: which identifier, lengths, stray spaces or quotes", () => {
  const sid = `AC${"a".repeat(32)}`;
  assert.equal(describeSignIn({ accountSid: sid, authToken: "t".repeat(32) }), "signed in with Account SID AC… (34 chars) and a 32-char auth token");
  assert.match(describeSignIn({ accountSid: sid, authToken: ` ${"t".repeat(32)}` }), /33-char auth token; contains spaces or quotes/);
  assert.equal(describeSignIn({ accountSid: sid, authToken: "x", apiKeySid: `SK${"b".repeat(32)}`, apiKeySecret: "s".repeat(32) }), "signed in with API key SK… (34 chars) and a 32-char secret");
  assert.doesNotMatch(describeSignIn({ accountSid: sid, authToken: "secretvalue1234567890" }), /secretvalue/);
});

test("Twilio's own code and message are kept when it refuses", async () => {
  const server = createServer((_req, res) => {
    res.statusCode = 401;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ code: 20003, message: "Authenticate", status: 401 }));
  });
  await new Promise<void>((done) => server.listen(0, done));
  process.env.TWILIO_API_URL = `http://localhost:${(server.address() as { port: number }).port}`;
  try {
    await assert.rejects(twilioAccount({ accountSid: `AC${"a".repeat(32)}`, authToken: "t".repeat(32) }), /HTTP 401, code 20003: Authenticate; signed in with Account SID AC… \(34 chars\) and a 32-char auth token/);
  } finally {
    delete process.env.TWILIO_API_URL;
    server.close();
  }
});
