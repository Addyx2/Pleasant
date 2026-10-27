export function assistSuggestions(role: string): string[] {
  return [
    "What needs my attention today?",
    "Which open shifts this week still need a carer?",
    "Who has DBS or right to work expiring this month?",
    "Approve the timesheets that are signed off by the client",
    ...(role === "ADMIN" ? ["How much are clients overdue on invoices?"] : []),
  ];
}
