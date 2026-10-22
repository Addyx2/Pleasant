// Presentation helpers for the audit trail, shared by the page and CSV export.

export const AUDIT_CATEGORIES = [
  { key: "auth", label: "Sign-in" },
  { key: "team", label: "Team" },
  { key: "settings", label: "Settings" },
  { key: "payroll", label: "Payroll" },
  { key: "invoice", label: "Invoices" },
  { key: "import", label: "Imports" },
  { key: "staff", label: "Workers" },
  { key: "client", label: "Clients" },
  { key: "assist", label: "Assist" },
  { key: "addon", label: "Add-ons" },
] as const;

export type AuditCategory = (typeof AUDIT_CATEGORIES)[number]["key"];

export function isAuditCategory(value: string | undefined | null): value is AuditCategory {
  return AUDIT_CATEGORIES.some((c) => c.key === value);
}

export function auditCategoryLabel(action: string): string {
  const key = action.split(".")[0];
  return AUDIT_CATEGORIES.find((c) => c.key === key)?.label ?? key;
}

// Actions an admin should notice when skimming the trail.
const SENSITIVE = new Set([
  "settings.bank_details",
  "team.role_change",
  "team.remove",
  "auth.locked",
  "payroll.status",
  "invoice.status",
  "client.rate",
  "client.signatory_add",
]);

export function isSensitiveAction(action: string): boolean {
  return SENSITIVE.has(action);
}
