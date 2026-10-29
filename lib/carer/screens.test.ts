import assert from "node:assert/strict";
import { test } from "node:test";

import { currentShift } from "./screens";

const at = (h: number) => new Date(Date.UTC(2026, 10, 3, h));
const shift = (id: string, start: number, end: number, timesheet: { clockOut: Date | null; status?: string; clientAuthAt?: Date | null; candidateSignedAt?: Date | null } | null = null) => ({
  id,
  startAt: at(start),
  endAt: at(end),
  timesheet: timesheet ? { status: "PENDING", clientAuthAt: null, ...timesheet } : null,
});

test("currentShift: the shift they're on comes first", () => {
  const now = at(12);
  const shifts = [shift("signed-off-older", 0, 4, { clockOut: at(4) }), shift("on", 10, 18, { clockOut: null }), shift("soon", 13, 20)];
  assert.equal(currentShift(shifts, now)?.id, "on");
});

test("currentShift: one starting within two hours beats one waiting for signatures", () => {
  const shifts = [shift("to-sign", 0, 4, { clockOut: at(4) }), shift("soon", 13, 20)];
  assert.equal(currentShift(shifts, at(12))?.id, "soon");
});

test("currentShift: the shift just finished is signed before older ones", () => {
  const shifts = [shift("older", 0, 4, { clockOut: at(4) }), shift("just-done", 6, 11, { clockOut: at(11) })];
  assert.equal(currentShift(shifts, at(12))?.id, "just-done");
});

test("currentShift: approved or client-signed shifts don't need signing", () => {
  const shifts = [shift("approved", 0, 4, { clockOut: at(4), status: "APPROVED" }), shift("client-signed", 6, 11, { clockOut: at(11), clientAuthAt: at(11) })];
  assert.equal(currentShift(shifts, at(12)), null);
});

test("currentShift: a shift waiting only on a Workspace home's signature doesn't take the card", () => {
  const waiting = { ...shift("signed-waiting-home", 6, 11, { clockOut: at(11) }), client: { aultrumBuyerId: "ws1" } };
  waiting.timesheet!.candidateSignedAt = at(11);
  const next = shift("tonight", 20, 23);
  assert.equal(currentShift([waiting, next], at(12))?.id, "tonight");
  // Without Workspace, the carer collects the home's signature on their phone, so it stays first.
  const onPhone = { ...waiting, client: { aultrumBuyerId: null } };
  assert.equal(currentShift([onPhone, next], at(12))?.id, "signed-waiting-home");
});
