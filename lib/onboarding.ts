import { expiryState } from "./compliance";
import { isValidBankDetails } from "./payroll/bacs";

// A carer is "bookable" once every onboarding step is done. Steps mirror what a
// care home audits on a placed temp: right to work, DBS, mandatory training,
// reviewed onboarding forms, and enough payroll detail to pay them.

export type StepState = "DONE" | "IN_REVIEW" | "TODO" | "BLOCKED";

export interface OnboardingStep {
  key: "RIGHT_TO_WORK" | "DBS" | "TRAINING" | "FORMS" | "PAYROLL" | "APP";
  label: string;
  state: StepState;
  detail: string;
}

export interface OnboardingSubject {
  niNumber: string | null;
  sortCode: string | null;
  bankAcct: string | null;
  dbsNumber: string | null;
  dbsExpiry: Date | null;
  userId: string | null;
  rightToWork: { status: string; expiryDate: Date | null } | null;
  trainingRecords: { status: string; expiryDate: Date | null }[];
  onboardingForms: { status: string }[];
}

export function onboardingSteps(s: OnboardingSubject, now: Date = new Date()): OnboardingStep[] {
  const rtw: OnboardingStep = (() => {
    if (!s.rightToWork) return { key: "RIGHT_TO_WORK", label: "Right to work", state: "TODO", detail: "No check recorded" };
    if (s.rightToWork.status === "REJECTED")
      return { key: "RIGHT_TO_WORK", label: "Right to work", state: "BLOCKED", detail: "Check rejected" };
    if (s.rightToWork.expiryDate && expiryState(s.rightToWork.expiryDate, now) === "EXPIRED")
      return { key: "RIGHT_TO_WORK", label: "Right to work", state: "BLOCKED", detail: "Permission expired" };
    if (s.rightToWork.status === "VERIFIED")
      return { key: "RIGHT_TO_WORK", label: "Right to work", state: "DONE", detail: "Verified" };
    return { key: "RIGHT_TO_WORK", label: "Right to work", state: "IN_REVIEW", detail: "Awaiting verification" };
  })();

  const dbs: OnboardingStep = (() => {
    if (!s.dbsNumber) return { key: "DBS", label: "DBS", state: "TODO", detail: "Certificate not on file" };
    const state = expiryState(s.dbsExpiry, now);
    if (state === "EXPIRED") return { key: "DBS", label: "DBS", state: "BLOCKED", detail: "Certificate expired" };
    return { key: "DBS", label: "DBS", state: "DONE", detail: "On file" };
  })();

  const training: OnboardingStep = (() => {
    const records = s.trainingRecords;
    if (records.length === 0) return { key: "TRAINING", label: "Training", state: "TODO", detail: "No courses recorded" };
    const expired = records.filter(
      (r) => r.status === "EXPIRED" || (r.expiryDate && expiryState(r.expiryDate, now) === "EXPIRED"),
    ).length;
    if (expired > 0)
      return { key: "TRAINING", label: "Training", state: "BLOCKED", detail: `${expired} course${expired === 1 ? "" : "s"} expired` };
    const pending = records.filter((r) => r.status !== "COMPLETED").length;
    if (pending > 0)
      return { key: "TRAINING", label: "Training", state: "IN_REVIEW", detail: `${pending} of ${records.length} outstanding` };
    return { key: "TRAINING", label: "Training", state: "DONE", detail: `${records.length} complete` };
  })();

  const forms: OnboardingStep = (() => {
    const all = s.onboardingForms;
    if (all.length === 0) return { key: "FORMS", label: "Forms", state: "TODO", detail: "None submitted" };
    if (all.some((f) => f.status === "REJECTED"))
      return { key: "FORMS", label: "Forms", state: "BLOCKED", detail: "A form was rejected" };
    const submitted = all.filter((f) => f.status === "SUBMITTED").length;
    if (submitted > 0)
      return { key: "FORMS", label: "Forms", state: "IN_REVIEW", detail: `${submitted} awaiting review` };
    if (all.every((f) => f.status === "APPROVED"))
      return { key: "FORMS", label: "Forms", state: "DONE", detail: `${all.length} approved` };
    return { key: "FORMS", label: "Forms", state: "TODO", detail: "Not yet submitted" };
  })();

  const payroll: OnboardingStep = (() => {
    const bank = isValidBankDetails(s.sortCode ?? "", s.bankAcct ?? "");
    if (bank && s.niNumber) return { key: "PAYROLL", label: "Payroll", state: "DONE", detail: "NI and bank on file" };
    const missing = [!s.niNumber ? "NI number" : null, !bank ? "bank details" : null].filter(Boolean).join(" and ");
    return { key: "PAYROLL", label: "Payroll", state: "TODO", detail: `Missing ${missing}` };
  })();

  const app: OnboardingStep = s.userId
    ? { key: "APP", label: "Workers app", state: "DONE", detail: "Invited" }
    : { key: "APP", label: "Workers app", state: "TODO", detail: "Not invited" };

  return [rtw, dbs, training, forms, payroll, app];
}

export function onboardingProgress(steps: OnboardingStep[]): number {
  return Math.round((steps.filter((s) => s.state === "DONE").length / steps.length) * 100);
}

/** Ready to book: everything except the app invite (which is a convenience). */
export function isBookable(steps: OnboardingStep[]): boolean {
  return steps.every((s) => s.key === "APP" || s.state === "DONE");
}
