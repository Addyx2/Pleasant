// Which areas of Pleasant Assist can read and change. Shared by the server
// (enforcement in toolsFor) and the Connections page (admin controls), so it
// imports nothing server-only.

export const ASSIST_GROUPS = [
  {
    key: "shifts",
    label: "Shifts & dispatch",
    description: "Shifts, availability, offers, carers' shift requests and the recurring rota.",
    adminOnly: false,
  },
  {
    key: "timesheets",
    label: "Timesheets",
    description: "Timesheets awaiting approval, and approving, rejecting or disputing them.",
    adminOnly: false,
  },
  {
    key: "workers",
    label: "Workers & compliance",
    description: "Carer profiles, DBS, right to work, training and Workers app invites.",
    adminOnly: false,
  },
  {
    key: "clients",
    label: "Clients",
    description: "Clients, units, contacts and signatories, rate cards and Pleasant Links.",
    adminOnly: false,
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Invoices, receivables, issuing and marking paid.",
    adminOnly: true,
  },
  {
    key: "payroll",
    label: "Payroll",
    description: "Pay runs: creating drafts and moving them through approval.",
    adminOnly: true,
  },
] as const;

export type AssistGroup = (typeof ASSIST_GROUPS)[number]["key"] | "general";

export const TOOL_GROUPS: Record<string, AssistGroup> = {
  search_records: "general",
  get_overview: "general",
  open_page: "general",
  list_shifts: "shifts",
  get_shift: "shifts",
  find_available_workers: "shifts",
  list_shift_requests: "shifts",
  list_rota_templates: "shifts",
  create_shift: "shifts",
  assign_shift: "shifts",
  set_shift_status: "shifts",
  offer_shift: "shifts",
  decide_shift_request: "shifts",
  generate_rota_week: "shifts",
  list_timesheets: "timesheets",
  decide_timesheet: "timesheets",
  list_workers: "workers",
  get_worker: "workers",
  compliance_alerts: "workers",
  create_worker: "workers",
  set_worker_status: "workers",
  invite_worker_to_app: "workers",
  record_dbs: "workers",
  add_training: "workers",
  list_clients: "clients",
  get_client: "clients",
  create_client: "clients",
  add_unit: "clients",
  add_client_contact: "clients",
  set_client_rate: "clients",
  create_pleasant_link: "clients",
  list_invoices: "invoices",
  create_invoice: "invoices",
  set_invoice_status: "invoices",
  list_payroll_runs: "payroll",
  generate_payroll_run: "payroll",
  set_payroll_status: "payroll",
};

export type Access = "read" | "write";

export function policyKey(group: string, access: Access): string {
  return `${group}:${access}`;
}

/** Normalise an admin's policy choices: turning off reading also turns off changing. */
export function normalisePolicy(disabled: string[]): string[] {
  const set = new Set(disabled.filter((d) => /^[a-z]+:(read|write)$/.test(d)));
  for (const d of [...set]) {
    const [group, access] = d.split(":");
    if (access === "read") set.add(policyKey(group, "write"));
  }
  return [...set].sort();
}

export function isAllowed(disabled: readonly string[], group: AssistGroup, access: Access): boolean {
  if (group === "general") return true;
  if (disabled.includes(policyKey(group, "read"))) return false;
  return access === "read" || !disabled.includes(policyKey(group, "write"));
}
