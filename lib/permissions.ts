// Role model. Kept free of server imports so client components (navigation,
// command palette) can share the same rules as the server guards in lib/auth.

export type AppRole = "ADMIN" | "MANAGER" | "STAFF";

export const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  STAFF: "Carer",
};

export const ROLE_DESCRIPTIONS: Record<Exclude<AppRole, "STAFF">, string> = {
  ADMIN: "Full access, including payroll, billing, agency settings and team.",
  MANAGER: "Day-to-day operations: shifts, dispatch, timesheets, workers, clients and compliance.",
};

export function isOpsRole(role: string): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

// Route prefixes that require the ADMIN role. Everything else in the back
// office is open to managers too.
export const ADMIN_ONLY_PREFIXES = [
  "/payroll",
  "/billing",
  "/billing-pack",
  "/invoice",
  "/settings",
  "/import",
  "/addons",
] as const;

export function canAccess(role: string, href: string): boolean {
  if (!isOpsRole(role)) return false;
  if (role === "ADMIN") return true;
  return !ADMIN_ONLY_PREFIXES.some((p) => href === p || href.startsWith(`${p}/`));
}
