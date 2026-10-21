import assert from "node:assert/strict";
import { test } from "node:test";

import { isBookable, onboardingProgress, onboardingSteps, type OnboardingSubject } from "./onboarding";

const now = new Date("2026-10-01T12:00:00Z");
const future = new Date("2027-10-01T12:00:00Z");
const past = new Date("2026-01-01T12:00:00Z");

const complete: OnboardingSubject = {
  niNumber: "QQ123456C",
  sortCode: "200000",
  bankAcct: "12345678",
  dbsNumber: "001234567890",
  dbsExpiry: future,
  userId: "u1",
  rightToWork: { status: "VERIFIED", expiryDate: null },
  trainingRecords: [{ status: "COMPLETED", expiryDate: future }],
  onboardingForms: [{ status: "APPROVED" }],
};

test("a fully onboarded carer is bookable at 100%", () => {
  const steps = onboardingSteps(complete, now);
  assert.ok(steps.every((s) => s.state === "DONE"), JSON.stringify(steps));
  assert.equal(onboardingProgress(steps), 100);
  assert.equal(isBookable(steps), true);
});

test("a brand-new carer has every step to do", () => {
  const steps = onboardingSteps(
    { ...complete, niNumber: null, sortCode: null, bankAcct: null, dbsNumber: null, dbsExpiry: null, userId: null, rightToWork: null, trainingRecords: [], onboardingForms: [] },
    now,
  );
  assert.ok(steps.every((s) => s.state === "TODO"));
  assert.equal(onboardingProgress(steps), 0);
  assert.equal(isBookable(steps), false);
});

test("expired DBS or training blocks booking", () => {
  const dbs = onboardingSteps({ ...complete, dbsExpiry: past }, now);
  assert.equal(dbs.find((s) => s.key === "DBS")?.state, "BLOCKED");
  assert.equal(isBookable(dbs), false);

  const training = onboardingSteps({ ...complete, trainingRecords: [{ status: "COMPLETED", expiryDate: past }] }, now);
  assert.equal(training.find((s) => s.key === "TRAINING")?.state, "BLOCKED");
});

test("missing app invite doesn't block booking", () => {
  const steps = onboardingSteps({ ...complete, userId: null }, now);
  assert.equal(isBookable(steps), true);
  assert.ok(onboardingProgress(steps) < 100);
});

test("submitted forms show as in review", () => {
  const steps = onboardingSteps({ ...complete, onboardingForms: [{ status: "SUBMITTED" }, { status: "APPROVED" }] }, now);
  assert.equal(steps.find((s) => s.key === "FORMS")?.state, "IN_REVIEW");
});
