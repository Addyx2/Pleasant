import Link from "next/link";
import { Plus } from "lucide-react";

import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatCurrency, initials } from "@/lib/utils";
import { Card, EmptyState, PageHeader, Td, Th, buttonClass, subtleButtonClass } from "@/components/ui";
import { StatusBadge } from "@/components/status";
import { setStaffStatusAction } from "./actions";

export const metadata = { title: "Staff" };
export const dynamic = "force-dynamic";

export default async function StaffPage() {
  const user = await requireUser();

  const staff = await prisma.staffProfile.findMany({
    where: { agencyId: user.agencyId },
    orderBy: [{ status: "asc" }, { lastName: "asc" }],
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Staff"
        description="Your carers, their rates and their payroll details."
        action={
          <Link href="/staff/new" className={buttonClass}>
            <Plus className="h-4 w-4" /> Add carer
          </Link>
        }
      />

      {staff.length === 0 ? (
        <EmptyState
          title="No carers yet"
          description="Add your first carer to start scheduling shifts."
          action={
            <Link href="/staff/new" className={buttonClass}>
              <Plus className="h-4 w-4" /> Add carer
            </Link>
          }
        />
      ) : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[860px]">
            <thead className="bg-slate-50">
              <tr>
                <Th>Carer</Th>
                <Th>Role</Th>
                <Th>Base rate</Th>
                <Th>Night / Weekend / BH</Th>
                <Th>Tax</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((member) => (
                <tr key={member.id} className="hover:bg-slate-50">
                  <Td>
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                        {initials(member.firstName, member.lastName)}
                      </span>
                      <div>
                        <p className="font-medium text-slate-900">
                          {member.firstName} {member.lastName}
                        </p>
                        <p className="text-xs text-slate-500">{member.email ?? member.phone ?? "—"}</p>
                      </div>
                    </div>
                  </Td>
                  <Td>
                    {member.jobTitle}
                    {member.band ? <span className="text-xs text-slate-500"> · {member.band}</span> : null}
                  </Td>
                  <Td>{formatCurrency(Number(member.baseRate))}</Td>
                  <Td className="text-xs text-slate-600">
                    {member.nightRate ? formatCurrency(Number(member.nightRate)) : "—"} /{" "}
                    {member.weekendRate ? formatCurrency(Number(member.weekendRate)) : "—"} /{" "}
                    {member.bankHolidayRate ? formatCurrency(Number(member.bankHolidayRate)) : "—"}
                  </Td>
                  <Td>
                    <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
                      {member.taxCode}
                    </span>
                  </Td>
                  <Td>
                    <StatusBadge status={member.status} />
                  </Td>
                  <Td>
                    <form action={setStaffStatusAction}>
                      <input type="hidden" name="staffId" value={member.id} />
                      <input
                        type="hidden"
                        name="status"
                        value={member.status === "ACTIVE" ? "INACTIVE" : "ACTIVE"}
                      />
                      <button type="submit" className={subtleButtonClass}>
                        {member.status === "ACTIVE" ? "Deactivate" : "Activate"}
                      </button>
                    </form>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
