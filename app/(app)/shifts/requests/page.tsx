import Link from "next/link";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDate, formatDateTime } from "@/lib/utils";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { approveShiftRequestAction, rejectShiftRequestAction } from "./actions";

export const metadata = { title: "Shift requests" };
export const dynamic = "force-dynamic";

const BANNERS: Record<string, { tone: "good" | "bad"; text: string }> = {
  approved: { tone: "good", text: "Request approved — carer assigned to the shift." },
  rejected: { tone: "bad", text: "Request declined." },
  taken: { tone: "bad", text: "That shift was already filled." },
};

export default async function ShiftRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdmin();
  const { result } = await searchParams;
  const banner = result != null && result in BANNERS ? BANNERS[result] : null;

  const pending = await prisma.shiftRequest.findMany({
    where: { status: "PENDING" },
    include: {
      shift: { include: { client: true, site: true } },
      staff: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const recent = await prisma.shiftRequest.findMany({
    where: { status: { in: ["APPROVED", "REJECTED"] } },
    include: {
      shift: true,
      staff: true,
    },
    orderBy: { updatedAt: "desc" },
    take: 10,
  });

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-start justify-between">
        <PageHeader
          title="Shift requests"
          description="Carers who want to pick up open shifts. Approve to assign automatically."
        />
        <Link href="/shifts" className="text-sm font-medium text-brand-700 hover:underline">
          View shifts
        </Link>
      </div>

      {banner ? (
        <div
          className={
            banner.tone === "good"
              ? "rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700"
              : "rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700"
          }
        >
          {banner.text}
        </div>
      ) : null}

      {pending.length === 0 ? (
        <EmptyState
          title="No pending requests"
          description="When carers request an open shift, it will show here."
        />
      ) : (
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Pending · {pending.length}
          </h2>
          {pending.map((req) => {
            const where =
              req.shift.client != null
                ? `${req.shift.client.firstName} ${req.shift.client.lastName}`
                : (req.shift.site?.name ?? "Location TBC");
            return (
              <Card key={req.id} className="p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-slate-900">{req.shift.title}</p>
                      <Badge tone="amber">Open</Badge>
                    </div>
                    <p className="mt-0.5 text-sm text-slate-600">{where}</p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {formatDateTime(req.shift.startAt)} · {req.shift.role} · applied{" "}
                      {formatDate(req.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {req.staff.firstName} {req.staff.lastName}
                    </p>
                    <p className="text-xs text-slate-500">{req.staff.jobTitle}</p>
                  </div>
                </div>

                {req.message ? (
                  <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                    “{req.message}”
                  </p>
                ) : null}

                <div className="mt-4 flex gap-3">
                  <form action={approveShiftRequestAction} className="flex-1">
                    <input type="hidden" name="requestId" value={req.id} />
                    <button
                      type="submit"
                      className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
                    >
                      Approve &amp; assign
                    </button>
                  </form>
                  <form action={rejectShiftRequestAction}>
                    <input type="hidden" name="requestId" value={req.id} />
                    <button
                      type="submit"
                      className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
                    >
                      Decline
                    </button>
                  </form>
                </div>
              </Card>
            );
          })}
        </section>
      )}

      {recent.length > 0 ? (
        <section className="space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">History</h2>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
            {recent.map((req) => (
              <div key={req.id} className="flex items-center justify-between px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">{req.shift.title}</p>
                  <p className="text-xs text-slate-500">
                    {req.staff.firstName} {req.staff.lastName} ·{" "}
                    {formatDate(req.updatedAt)}
                  </p>
                </div>
                <Badge tone={req.status === "APPROVED" ? "green" : "red"}>
                  {req.status.toLowerCase()}
                </Badge>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}