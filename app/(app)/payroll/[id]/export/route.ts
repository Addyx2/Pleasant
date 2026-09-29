import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildFpsCsv } from "@/lib/payroll/rti";

export const dynamic = "force-dynamic";

function fileName(runReference: string, taxYear: string): string {
  return `pleasant-rti-${runReference}-${taxYear.replace("/", "-")}.csv`;
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

  const payslips = run.payslips.map((p) => ({
    employee: { firstName: p.staff.firstName, lastName: p.staff.lastName },
    niNumber: p.niNumber,
    taxCode: p.taxCode,
    hours: Number(p.timesheetHours),
    grossPay: Number(p.grossPay),
    holidayPay: Number(p.holidayPay),
    expenses: Number(p.expenses),
    taxablePay: Number(p.taxablePay),
    paye: Number(p.paye),
    niEmployee: Number(p.niEmployee),
    niEmployer: Number(p.employerNi),
    pensionEmployee: Number(p.pensionEmployee),
    pensionEmployer: Number(p.pensionEmployer),
    studentLoan: Number(p.studentLoan),
    otherDeductions: Number(p.otherDeductions),
    netPay: Number(p.netPay),
  }));

  const { csv } = buildFpsCsv({
    runReference: run.reference,
    taxYear: run.taxYear,
    payFrequency: (run.agency.payFrequency ?? "WEEKLY") as "WEEKLY" | "FORTNIGHTLY" | "FOUR_WEEKLY" | "MONTHLY",
    paymentDate: run.payDate,
    employerPayeRef: run.agency.payrollRef,
    payslips,
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fileName(run.reference, run.taxYear)}"`,
    },
  });
}