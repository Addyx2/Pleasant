-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "ShiftRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'FINALISED', 'PAID');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_COST');

-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('HOURLY', 'SALARY');

-- CreateTable
CREATE TABLE "Agency" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "postcode" TEXT,
    "payrollRef" TEXT,
    "payFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "cutoffWeekday" INTEGER NOT NULL DEFAULT 1,
    "cutoffTime" TEXT NOT NULL DEFAULT '16:00',
    "payWeekday" INTEGER NOT NULL DEFAULT 5,
    "roundingMins" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Agency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'MANAGER',
    "lastLoginAt" TIMESTAMP(3),
    "resetTokenHash" TEXT,
    "resetTokenExpAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "jobTitle" TEXT NOT NULL,
    "band" TEXT,
    "status" "StaffStatus" NOT NULL DEFAULT 'ACTIVE',
    "engagementType" TEXT NOT NULL DEFAULT 'PAYE',
    "ltdCompanyName" TEXT,
    "niNumber" TEXT,
    "taxCode" TEXT NOT NULL DEFAULT '1257L',
    "studentLoanPlan" TEXT,
    "payBasis" "PayBasis" NOT NULL DEFAULT 'HOURLY',
    "baseRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "nightRate" DECIMAL(8,2),
    "weekendRate" DECIMAL(8,2),
    "bankHolidayRate" DECIMAL(8,2),
    "holidayAccrualPct" DECIMAL(5,2) NOT NULL DEFAULT 12.07,
    "pensionEnrolled" BOOLEAN NOT NULL DEFAULT true,
    "pensionEmployeePct" DECIMAL(4,2) NOT NULL DEFAULT 5,
    "pensionEmployerPct" DECIMAL(4,2) NOT NULL DEFAULT 3,
    "startDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "careLevel" TEXT,
    "notes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Site_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Shift" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "siteId" TEXT,
    "staffId" TEXT,
    "createdById" TEXT,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "breakMins" INTEGER NOT NULL DEFAULT 0,
    "chargeRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "isSleepIn" BOOLEAN NOT NULL DEFAULT false,
    "sleepInRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "status" "ShiftStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Shift_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftRequest" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "message" TEXT,
    "status" "ShiftRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShiftRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Timesheet" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "clockIn" TIMESTAMP(3) NOT NULL,
    "clockOut" TIMESTAMP(3),
    "breakMins" INTEGER NOT NULL DEFAULT 0,
    "workedMins" INTEGER NOT NULL DEFAULT 0,
    "status" "TimesheetStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "expenses" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "expenseNotes" TEXT,
    "candidateSignature" TEXT,
    "candidateSignedAt" TIMESTAMP(3),
    "clientAuthName" TEXT,
    "clientAuthPosition" TEXT,
    "clientAuthAt" TIMESTAMP(3),
    "clientAuthSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Timesheet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayrollRun" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "taxYear" TEXT NOT NULL,
    "status" "PayrollStatus" NOT NULL DEFAULT 'DRAFT',
    "grossTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "niTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pensionTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employerNiTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payslip" (
    "id" TEXT NOT NULL,
    "payrollRunId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "timesheetHours" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "grossPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "holidayPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "expenses" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxablePay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paye" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "niEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pensionEmployee" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "pensionEmployer" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "studentLoan" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherDeductions" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "employerNi" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxCode" TEXT NOT NULL,
    "niNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payslip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayslipLine" (
    "id" TEXT NOT NULL,
    "payslipId" TEXT NOT NULL,
    "type" "LineType" NOT NULL,
    "label" TEXT NOT NULL,
    "quantity" DECIMAL(8,2),
    "rate" DECIMAL(8,4),
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PayslipLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_agencyId_status_idx" ON "StaffProfile"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Client_agencyId_status_idx" ON "Client"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Site_agencyId_idx" ON "Site"("agencyId");

-- CreateIndex
CREATE INDEX "Shift_agencyId_startAt_idx" ON "Shift"("agencyId", "startAt");

-- CreateIndex
CREATE INDEX "Shift_agencyId_status_idx" ON "Shift"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Shift_staffId_startAt_idx" ON "Shift"("staffId", "startAt");

-- CreateIndex
CREATE INDEX "ShiftRequest_agencyId_status_idx" ON "ShiftRequest"("agencyId", "status");

-- CreateIndex
CREATE INDEX "ShiftRequest_staffId_status_idx" ON "ShiftRequest"("staffId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftRequest_shiftId_staffId_key" ON "ShiftRequest"("shiftId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Timesheet_shiftId_key" ON "Timesheet"("shiftId");

-- CreateIndex
CREATE INDEX "Timesheet_agencyId_status_idx" ON "Timesheet"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Timesheet_staffId_clockIn_idx" ON "Timesheet"("staffId", "clockIn");

-- CreateIndex
CREATE INDEX "PayrollRun_agencyId_status_idx" ON "PayrollRun"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PayrollRun_agencyId_reference_key" ON "PayrollRun"("agencyId", "reference");

-- CreateIndex
CREATE INDEX "Payslip_staffId_idx" ON "Payslip"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "Payslip_payrollRunId_staffId_key" ON "Payslip"("payrollRunId", "staffId");

-- CreateIndex
CREATE INDEX "PayslipLine_payslipId_idx" ON "PayslipLine"("payslipId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRequest" ADD CONSTRAINT "ShiftRequest_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRequest" ADD CONSTRAINT "ShiftRequest_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftRequest" ADD CONSTRAINT "ShiftRequest_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Timesheet" ADD CONSTRAINT "Timesheet_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayrollRun" ADD CONSTRAINT "PayrollRun_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payslip" ADD CONSTRAINT "Payslip_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayslipLine" ADD CONSTRAINT "PayslipLine_payslipId_fkey" FOREIGN KEY ("payslipId") REFERENCES "Payslip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

