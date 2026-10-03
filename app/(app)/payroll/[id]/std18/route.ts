import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  buildBacsStd18,
  isValidBankDetails,
  normalizeAccount,
  normalizeSortCode,
} from "@/lib/payroll/bacs";

export const dynamic = "force-dynamic";

/**
 * Fixed-width BACS STD18 payment file. Unlike the CSV download this needs the
 * originator's own bank details, so an agency that hasn't recorded them gets
 * a clear 400 rather than a file a bank would reject.
 */
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

  const originator = {
    sortCode: run.agency.bankSortCode ?? "",
    bankAcct: run.agency.bankAccount ?? "",
    name: run.agency.bankAccountName ?? run.agency.name,
  };
  if (!isValidBankDetails(originator.sortCode, originator.bankAcct)) {
    return new Response(
      "Add your agency sort code and account number in Settings before downloading a BACS file.",
      { status: 400 },
    );
  }

  const { records, count, skipped, total } = buildBacsStd18({
    runReference: run.reference,
    paymentDate: run.payDate,
    originator,
    payees: run.payslips.map((p) => ({
      reference: `PAY${run.reference.replace(/[^A-Za-z0-9]/g, "")}`.slice(0, 18),
      staffName: `${p.staff.firstName} ${p.staff.lastName}`,
      accountName: p.staff.accountName ?? `${p.staff.firstName} ${p.staff.lastName}`,
      sortCode: p.staff.sortCode ?? "",
      bankAcct: p.staff.bankAcct ?? "",
      amount: Number(p.netPay),
    })),
  });

  if (count === 0) {
    return new Response("No staff in this run have usable bank details.", { status: 400 });
  }

  // One "H" header, one "F" footer around the detail records. Counts are
  // zero-padded to six characters as the format requires.
  const header = [
    "H",
    `${count}`.padStart(6, "0"),
    `${Math.round(total * 100)}`.padStart(12, "0"),
    normalizeSortCode(originator.sortCode),
    normalizeAccount(originator.bankAcct),
    " ".repeat(32),
  ].join("");
  const footer = ["F", `${count}`.padStart(6, "0"), `${count}`.padStart(6, "0")].join("");
  const body = [header, ...records, footer].map((line) => line.padEnd(96, " ")).join("\r\n");

  const note = skipped > 0 ? ` (${skipped} without bank details excluded)` : "";
  return new Response(`${body}\r\n`, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Disposition": `attachment; filename="pleasant-std18-${run.reference}${note}.txt"`,
    },
  });
}