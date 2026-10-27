import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildPaymentsCsv } from "@/lib/payroll/bacs";

export const dynamic = "force-dynamic";

function originatorFor(agency: {
  bankSortCode: string | null;
  bankAccount: string | null;
  bankAccountName: string | null;
  name: string;
}) {
  return {
    sortCode: agency.bankSortCode ?? "",
    bankAcct: agency.bankAccount ?? "",
    name: agency.bankAccountName ?? agency.name,
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") return new Response("Unauthorized", { status: 401 });

  const { id } = await params;
  const run = await prisma.payrollRun.findFirst({
    where: { id, agencyId: user.agencyId },
    include: {
      agency: true,
      payslips: { include: { staff: true }, orderBy: { staff: { lastName: "asc" } } },
    },
  });
  if (!run) return new Response("Not found", { status: 404 });
  if (run.status === "DRAFT") return new Response("Finalise the run before exporting", { status: 403 });

  const { csv } = buildPaymentsCsv({
    runReference: run.reference,
    paymentDate: run.payDate,
    originator: originatorFor(run.agency),
    payees: run.payslips.map((p) => ({
      reference: `PAY${run.reference.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 18),
      staffName: `${p.staff.firstName} ${p.staff.lastName}`,
      accountName: p.staff.accountName ?? `${p.staff.firstName} ${p.staff.lastName}`,
      sortCode: p.staff.sortCode ?? "",
      bankAcct: p.staff.bankAcct ?? "",
      amount: Number(p.netPay),
    })),
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pleasant-payments-${run.reference}.csv"`,
    },
  });
}