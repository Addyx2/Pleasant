// Activity labels shown while Assist uses a read tool (client-safe).

const TOOL_LABELS: Record<string, string> = {
  search_records: "Searching",
  get_overview: "Checking today's overview",
  list_shifts: "Looking up shifts",
  get_shift: "Opening the shift",
  find_available_workers: "Finding available carers",
  list_workers: "Looking up carers",
  get_worker: "Opening the carer's profile",
  list_clients: "Looking up clients",
  get_client: "Opening the client",
  list_timesheets: "Looking up timesheets",
  list_shift_requests: "Checking shift requests",
  compliance_alerts: "Checking compliance",
  list_rota_templates: "Looking up rota templates",
  list_invoices: "Looking up invoices",
  list_payroll_runs: "Looking up pay runs",
  open_page: "Opening the page",
};

export function toolLabel(name: string): string {
  return TOOL_LABELS[name] ?? "Preparing a change";
}
