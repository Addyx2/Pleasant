import Link from "next/link";
import { Download, ScrollText } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import {
  AUDIT_CATEGORIES,
  auditCategoryLabel,
  isAuditCategory,
  isSensitiveAction,
} from "@/lib/audit-format";
import { prisma } from "@/lib/db";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge, Card, EmptyState, Td, Th, subtleButtonClass } from "@/components/ui";

export const metadata = { title: "Audit log" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; page?: string }>;
}) {
  const admin = await requireAdmin();
  const params = await searchParams;
  const category = isAuditCategory(params.category) ? params.category : null;
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  const where = {
    agencyId: admin.agencyId,
    ...(category ? { action: { startsWith: `${category}.` } } : {}),
  };
  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.auditEvent.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (next: { category?: string | null; page?: number }) => {
    const q = new URLSearchParams();
    const c = next.category === undefined ? category : next.category;
    if (c) q.set("category", c);
    if (next.page && next.page > 1) q.set("page", String(next.page));
    const s = q.toString();
    return s ? `/settings/audit?${s}` : "/settings/audit";
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <ScrollText className="h-4 w-4 text-brand-600" />
            <h2 className="text-sm font-semibold text-slate-900">Audit log</h2>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Append-only record of sign-ins, team changes, bank details, pay runs and invoices.
          </p>
        </div>
        <a href={`/settings/audit/export${category ? `?category=${category}` : ""}`} className={subtleButtonClass}>
          <Download className="h-4 w-4" />
          Export CSV
        </a>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-5 py-3">
        {[{ key: null, label: "All" }, ...AUDIT_CATEGORIES].map((c) => (
          <Link
            key={c.key ?? "all"}
            href={href({ category: c.key, page: 1 })}
            className={cn(
              "rounded-full px-3 py-1 text-xs font-medium transition",
              category === c.key
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200",
            )}
          >
            {c.label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="p-5">
          <EmptyState
            title="Nothing recorded yet"
            description="Events appear here as your team signs in, runs payroll and issues invoices."
          />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-100">
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Who</Th>
                <Th>Area</Th>
                <Th>What happened</Th>
                <Th>IP</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {events.map((event) => (
                <tr key={event.id}>
                  <Td className="whitespace-nowrap text-xs text-slate-500 tabular">
                    {formatDateTime(event.createdAt)}
                  </Td>
                  <Td className="max-w-[14rem] truncate text-xs">{event.actorEmail ?? "System"}</Td>
                  <Td>
                    <Badge tone={isSensitiveAction(event.action) ? "amber" : "slate"}>
                      {auditCategoryLabel(event.action)}
                    </Badge>
                  </Td>
                  <Td className="text-sm text-slate-800">{event.summary}</Td>
                  <Td className="whitespace-nowrap font-mono text-[11px] text-slate-400">{event.ip ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500">
          <span>
            Page {page} of {pages} · {total} events
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link href={href({ page: page - 1 })} className="font-medium text-brand-700 hover:text-brand-800">
                ← Newer
              </Link>
            ) : null}
            {page < pages ? (
              <Link href={href({ page: page + 1 })} className="font-medium text-brand-700 hover:text-brand-800">
                Older →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
