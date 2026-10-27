import { requireAdmin } from "@/lib/auth";
import { recordAudit } from "@/lib/audit";
import { isAuditCategory } from "@/lib/audit-format";
import { csvCell } from "@/lib/csv";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const admin = await requireAdmin();
  const category = new URL(request.url).searchParams.get("category");

  const events = await prisma.auditEvent.findMany({
    where: {
      agencyId: admin.agencyId,
      ...(isAuditCategory(category) ? { action: { startsWith: `${category}.` } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 10_000,
  });

  const header = ["timestamp", "actor", "action", "summary", "target_type", "target_id", "ip"];
  const rows = events.map((e) =>
    [e.createdAt.toISOString(), e.actorEmail, e.action, e.summary, e.targetType, e.targetId, e.ip]
      .map(csvCell)
      .join(","),
  );

  await recordAudit(admin, {
    action: "settings.audit_export",
    summary: `Exported ${events.length} audit events`,
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return new Response([header.join(","), ...rows].join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pleasant-audit-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
