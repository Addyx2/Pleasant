import { Badge } from "./ui";

const MAP: Record<string, { tone: Parameters<typeof Badge>[0]["tone"]; label: string }> = {
  DRAFT: { tone: "slate", label: "Draft" },
  OPEN: { tone: "amber", label: "Open" },
  ASSIGNED: { tone: "blue", label: "Assigned" },
  IN_PROGRESS: { tone: "brand", label: "In progress" },
  COMPLETED: { tone: "green", label: "Completed" },
  CANCELLED: { tone: "red", label: "Cancelled" },
  NO_SHOW: { tone: "red", label: "No show" },
  ACTIVE: { tone: "green", label: "Active" },
  INACTIVE: { tone: "slate", label: "Inactive" },
  ON_LEAVE: { tone: "amber", label: "On leave" },
  PAUSED: { tone: "amber", label: "Paused" },
  DISCHARGED: { tone: "slate", label: "Discharged" },
  PENDING: { tone: "amber", label: "Pending" },
  APPROVED: { tone: "green", label: "Approved" },
  REJECTED: { tone: "red", label: "Rejected" },
  DISPUTED: { tone: "red", label: "Disputed" },
  FINALISED: { tone: "brand", label: "Finalised" },
  PAID: { tone: "green", label: "Paid" },
};

export function StatusBadge({ status }: { status: string }) {
  const entry = MAP[status] ?? { tone: "neutral" as const, label: status };
  return <Badge tone={entry.tone}>{entry.label}</Badge>;
}
