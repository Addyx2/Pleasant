import { FileUp, History } from "lucide-react";

import { requireAdmin } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/utils";
import { Card, PageHeader } from "@/components/ui";
import { ImportWizard } from "./ImportWizard";

export const metadata = { title: "Import data | Pleasant" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  clients: "Clients",
  workers: "Carers",
  shifts: "Shifts",
};

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requireAdmin();
  const params = await searchParams;
  const result = typeof params.result === "string" ? params.result : null;
  const count = typeof params.count === "string" ? params.count : "0";
  const skipped = typeof params.skipped === "string" ? params.skipped : "0";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Import your data"
        description="Moving from a spreadsheet or another system? Bring your clients, carers and shifts across in one upload."
      />

      {result === "created" ? (
        <Card className="border-emerald-200 bg-emerald-50 p-5">
          <p className="text-sm font-semibold text-emerald-900">
            Imported {count} record{count === "1" ? "" : "s"}
            {skipped !== "0" ? ` · skipped ${skipped}` : ""}
          </p>
        </Card>
      ) : null}
      {result === "none" ? (
        <Card className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            Nothing was created — every row was either a duplicate or unreadable. Check the columns and try again.
          </p>
        </Card>
      ) : null}

      <Card className="p-5">
        <div className="mb-5 flex items-center gap-2.5">
          <FileUp className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Upload a CSV</h2>
        </div>
        <ImportWizard />
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center gap-2.5">
          <History className="h-4 w-4 text-slate-400" />
          <h2 className="text-sm font-semibold text-slate-900">Recent imports</h2>
        </div>
        <ImportHistory />
      </Card>
    </div>
  );
}

async function ImportHistory() {
  const user = await requireAdmin();
  const sessions = await prisma.importSession.findMany({
    where: { agencyId: user.agencyId },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  if (sessions.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Nothing imported yet. Your first upload will show up here. Existing records are never overwritten —
        matching rows are skipped.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-slate-100">
      {sessions.map((session) => (
        <li key={session.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
          <span className="font-medium text-slate-900">
            {KIND_LABEL[session.kind] ?? session.kind}
            <span className="ml-2 text-xs font-normal text-slate-500">
              {session.totalRows} row{session.totalRows === 1 ? "" : "s"} read
            </span>
          </span>
          <span className="text-xs text-slate-500">
            {session.status === "COMPLETED"
              ? `${session.createdRows} imported · ${session.skippedRows} skipped · ${formatDateTime(session.createdAt)}`
              : `Checked ${formatDateTime(session.createdAt)}`}
          </span>
        </li>
      ))}
    </ul>
  );
}