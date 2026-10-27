import assert from "node:assert/strict";
import { test } from "node:test";

process.env.AUTH_SECRET ??= "test-secret-test-secret-test-secret-123";

import { parseFeed } from "./bank-holidays";
import { seal, unseal } from "./crypto";
import { displayPhone, toE164 } from "./phone";
import { offerText } from "./sms-offers";
import { parseOfferReply, twilioSignature, validTwilioSignature } from "./twilio";
import { parseXeroDate, xeroErrorMessage } from "./xero/api";
import { xeroInvoicePayload } from "./xero/sync";

test("sealed credentials round-trip and reject tampering", () => {
  const sealed = seal({ token: "secret-value" });
  assert.ok(!sealed.includes("secret-value"));
  assert.deepEqual(unseal(sealed), { token: "secret-value" });
  const parts = sealed.split(".");
  parts[3] = Buffer.from("tampered").toString("base64url");
  assert.equal(unseal(parts.join(".")), null);
  assert.equal(unseal("junk"), null);
  assert.equal(unseal(null), null);
});

test("toE164 normalises UK numbers", () => {
  assert.equal(toE164("07700 900123"), "+447700900123");
  assert.equal(toE164("+44 (0)7700 900123"), "+447700900123");
  assert.equal(toE164("0044 7700 900123"), "+447700900123");
  assert.equal(toE164("+1 415 867 5310"), "+14158675310");
  assert.equal(toE164("7700900123"), null);
  assert.equal(toE164("call me"), null);
  assert.equal(toE164(null), null);
  assert.equal(displayPhone("+447700900123"), "07700 900123");
});

test("Twilio signatures cover the URL and sorted parameters", () => {
  const params = { From: "+447700900123", Body: "YES 4821", AccountSid: "AC123" };
  const url = "https://app.example.com/api/webhooks/twilio/abc";
  const sig = twilioSignature("token", url, params);
  assert.equal(sig, twilioSignature("token", url, { AccountSid: "AC123", Body: "YES 4821", From: "+447700900123" }));
  assert.ok(validTwilioSignature("token", sig, ["https://other.example", url], params));
  assert.ok(!validTwilioSignature("wrong", sig, [url], params));
  assert.ok(!validTwilioSignature("token", sig, [url], { ...params, Body: "NO 4821" }));
  assert.ok(!validTwilioSignature("token", null, [url], params));
});

test("parseOfferReply reads yes/no answers with optional codes", () => {
  assert.deepEqual(parseOfferReply("YES 4821"), { accept: true, code: "4821" });
  assert.deepEqual(parseOfferReply("yes"), { accept: true, code: null });
  assert.deepEqual(parseOfferReply("No, 4821."), { accept: false, code: "4821" });
  assert.deepEqual(parseOfferReply("ok"), { accept: true, code: null });
  assert.equal(parseOfferReply("What time does it start?"), null);
  assert.equal(parseOfferReply(""), null);
});

test("offerText names the shift and the reply code", () => {
  const text = offerText({
    agencyName: "Brightwater Care",
    startAt: new Date("2026-10-31T08:00:00Z"),
    endAt: new Date("2026-10-31T20:00:00Z"),
    role: "Care Assistant",
    place: "Oakfield Nursing Home",
    code: "4821",
  });
  assert.match(text, /^Brightwater Care: shift offer, Sat 31 Oct, 08:00–20:00, Care Assistant at Oakfield Nursing Home\./);
  assert.match(text, /Reply YES 4821 .* NO 4821/);
});

test("parseFeed keeps well-formed GOV.UK events for each nation", () => {
  const feed = {
    "england-and-wales": { division: "england-and-wales", events: [{ title: "Christmas Day", date: "2026-12-25" }, { title: "Bad", date: "25/12/2026" }] },
    scotland: { division: "scotland", events: [{ title: "St Andrew’s Day", date: "2026-11-30" }] },
    elsewhere: { events: [{ title: "x", date: "2026-01-01" }] },
  };
  assert.deepEqual(parseFeed(feed), [
    { division: "england-and-wales", date: "2026-12-25", title: "Christmas Day" },
    { division: "scotland", date: "2026-11-30", title: "St Andrew’s Day" },
  ]);
  assert.deepEqual(parseFeed(null), []);
});

test("parseXeroDate reads Xero's JSON dates", () => {
  assert.equal(parseXeroDate("/Date(1761868800000+0000)/")?.toISOString(), "2025-10-31T00:00:00.000Z");
  assert.equal(parseXeroDate("2026-10-31T00:00:00")?.getFullYear(), 2026);
  assert.equal(parseXeroDate(undefined), null);
  assert.equal(parseXeroDate("nonsense"), null);
});

test("xeroErrorMessage surfaces validation messages", () => {
  assert.equal(
    xeroErrorMessage({ Elements: [{ ValidationErrors: [{ Message: "Invoice # must be unique." }] }] }, 400),
    "Invoice # must be unique.",
  );
  assert.match(xeroErrorMessage({}, 401), /Reconnect Xero/);
});

test("xeroInvoicePayload maps a Pleasant invoice to a Xero sales invoice", () => {
  const payload = xeroInvoicePayload(
    {
      invoiceNumber: "INV-0042",
      reference: "PO-9",
      contactName: "Oakfield",
      contactEmail: null,
      contactAddress: null,
      contactPostcode: null,
      invoiceDate: new Date("2026-10-31T23:30:00Z"), // 31 Oct in the UK (GMT)
      dueDate: new Date("2026-11-30T12:00:00Z"),
      currency: "GBP",
      taxType: "Exempt Income",
      lines: [{ description: "Day shift", quantity: 12, unitAmount: 21.5 }],
    },
    "contact-1",
    { status: "AUTHORISED", accountCode: "200" },
  );
  assert.equal(payload.Type, "ACCREC");
  assert.equal(payload.Date, "2026-10-31");
  assert.equal(payload.DueDate, "2026-11-30");
  assert.equal(payload.Status, "AUTHORISED");
  assert.deepEqual(payload.Contact, { ContactID: "contact-1" });
  assert.deepEqual(payload.LineItems, [{ Description: "Day shift", Quantity: 12, UnitAmount: 21.5, AccountCode: "200", TaxType: "EXEMPTOUTPUT" }]);
});
