-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ON_LEAVE');

-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVE', 'PAUSED', 'DISCHARGED');

-- CreateEnum
CREATE TYPE "ShiftStatus" AS ENUM ('DRAFT', 'OPEN', 'ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW', 'UNATTENDED');

-- CreateEnum
CREATE TYPE "ShiftRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ShiftOfferStatus" AS ENUM ('OFFERED', 'ACCEPTED', 'DECLINED');

-- CreateEnum
CREATE TYPE "TimesheetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'DISPUTED');

-- CreateEnum
CREATE TYPE "PayrollStatus" AS ENUM ('DRAFT', 'APPROVED', 'FINALISED', 'PAID');

-- CreateEnum
CREATE TYPE "AddonKey" AS ENUM ('GATEWAY', 'PEAK');

-- CreateEnum
CREATE TYPE "LineType" AS ENUM ('EARNING', 'DEDUCTION', 'EMPLOYER_COST');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PayBasis" AS ENUM ('HOURLY', 'SALARY');

-- CreateEnum
CREATE TYPE "ClientType" AS ENUM ('CARE_HOME', 'NURSING_HOME', 'DOMICILIARY_PROVIDER', 'SUPPORTED_LIVING', 'NHS', 'LOCAL_AUTHORITY', 'OTHER');

-- CreateEnum
CREATE TYPE "IntegrationStatus" AS ENUM ('CONNECTED', 'ERROR');

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
    "companyNo" TEXT,
    "vatNumber" TEXT,
    "invoiceEmail" TEXT,
    "bankSortCode" TEXT,
    "bankAccount" TEXT,
    "bankAccountName" TEXT,
    "payFrequency" TEXT NOT NULL DEFAULT 'WEEKLY',
    "cutoffWeekday" INTEGER NOT NULL DEFAULT 1,
    "cutoffTime" TEXT NOT NULL DEFAULT '16:00',
    "payWeekday" INTEGER NOT NULL DEFAULT 5,
    "roundingMins" INTEGER NOT NULL DEFAULT 15,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "assistDisabled" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "assistMonthlyCapUsd" INTEGER,
    "bankHolidayDivision" TEXT NOT NULL DEFAULT 'england-and-wales',

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
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "deactivatedAt" TIMESTAMP(3),
    "aultrumSub" TEXT,
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
    "aultrumSub" TEXT,
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
    "bankName" TEXT,
    "accountName" TEXT,
    "sortCode" TEXT,
    "bankAcct" TEXT,
    "dbsNumber" TEXT,
    "dbsExpiry" TIMESTAMP(3),
    "startDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Client" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "name" TEXT,
    "type" "ClientType" NOT NULL DEFAULT 'CARE_HOME',
    "address" TEXT,
    "postcode" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "vatNumber" TEXT,
    "companyNo" TEXT,
    "cqcLocationId" TEXT,
    "frameworkRef" TEXT,
    "xeroContactId" TEXT,
    "paymentTermsDays" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "status" "ClientStatus" NOT NULL DEFAULT 'ACTIVE',
    "aultrumBuyerId" TEXT,
    "aultrumBuyerName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "firstName" TEXT,
    "lastName" TEXT,
    "companyName" TEXT,
    "careLevel" TEXT,

    CONSTRAINT "Client_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientContact" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "jobTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isSignatory" BOOLEAN NOT NULL DEFAULT false,
    "isAccounts" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientRate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteId" TEXT,
    "role" TEXT NOT NULL,
    "dayRate" DECIMAL(8,2) NOT NULL,
    "nightRate" DECIMAL(8,2),
    "weekendRate" DECIMAL(8,2),
    "bankHolidayRate" DECIMAL(8,2),
    "sleepInCharge" DECIMAL(8,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Site" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "postcode" TEXT,
    "notes" TEXT,
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
    "rotaTemplateId" TEXT,
    "title" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "startAt" TIMESTAMP(3) NOT NULL,
    "endAt" TIMESTAMP(3) NOT NULL,
    "breakMins" INTEGER NOT NULL DEFAULT 0,
    "chargeRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "isSleepIn" BOOLEAN NOT NULL DEFAULT false,
    "sleepInRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "sleepInCharge" DECIMAL(8,2),
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
    "clockInLat" DOUBLE PRECISION,
    "clockInLng" DOUBLE PRECISION,
    "clockInAccuracyM" INTEGER,
    "breakStartedAt" TIMESTAMP(3),
    "breakTakenMins" INTEGER NOT NULL DEFAULT 0,
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

-- CreateTable
CREATE TABLE "ShiftComment" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "staffId" TEXT,
    "userId" TEXT,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShiftComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDocument" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "documentUrl" TEXT,
    "signature" TEXT,
    "signedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RightToWork" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "documentNumber" TEXT,
    "issueDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "documentUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "RightToWork_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingRecord" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "courseName" TEXT NOT NULL,
    "provider" TEXT,
    "completedAt" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "certificateUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TrainingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingForm" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "formType" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "reviewedById" TEXT,

    CONSTRAINT "OnboardingForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushMessageLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENT',
    "aiAgentId" TEXT,
    "externalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PushMessageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PleasantLinkToken" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contactId" TEXT,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PleasantLinkToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientComplaint" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "shiftId" TEXT,
    "staffId" TEXT,
    "category" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'MEDIUM',
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ClientConfidenceRating" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "score" DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    "cancellationPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "promptPaymentPct" DECIMAL(5,2) NOT NULL DEFAULT 100.0,
    "siteSafetyScore" DECIMAL(3,2) NOT NULL DEFAULT 5.00,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClientConfidenceRating_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentTask" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agentType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "payload" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedTo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentLog" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AgentLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushbotCampaign" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "targetRole" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'WHATSAPP',
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "offersSent" INTEGER NOT NULL DEFAULT 0,
    "claimedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushbotCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "issueDate" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "hoursTotal" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "chargeTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "payTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "marginTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRatePct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "vatTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "grandTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "xeroInvoiceId" TEXT,
    "xeroStatus" TEXT,
    "xeroSyncedAt" TIMESTAMP(3),

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "timesheetId" TEXT,
    "shiftId" TEXT,
    "staffId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "hours" DECIMAL(8,2) NOT NULL,
    "chargeRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "chargeAmount" DECIMAL(12,2) NOT NULL,
    "payAmount" DECIMAL(12,2) NOT NULL,
    "marginAmount" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaTemplate" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RotaTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RotaTemplateLine" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "startMins" INTEGER NOT NULL,
    "endMins" INTEGER NOT NULL,
    "breakMins" INTEGER NOT NULL DEFAULT 0,
    "isSleepIn" BOOLEAN NOT NULL DEFAULT false,
    "sleepInRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "sleepInCharge" DECIMAL(8,2),
    "chargeRate" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "clientId" TEXT,
    "staffId" TEXT,
    "siteId" TEXT,

    CONSTRAINT "RotaTemplateLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShiftOffer" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "shiftId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "status" "ShiftOfferStatus" NOT NULL DEFAULT 'OFFERED',
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "note" TEXT,

    CONSTRAINT "ShiftOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportSession" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "headers" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "createdRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgencyAddon" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "key" "AddonKey" NOT NULL,
    "installed" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "installedAt" TIMESTAMP(3),
    "elementsInstallationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgencyAddon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "actorId" TEXT,
    "actorEmail" TEXT,
    "action" TEXT NOT NULL,
    "targetType" TEXT,
    "targetId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistConversation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "messages" JSONB NOT NULL DEFAULT '[]',
    "summaries" JSONB NOT NULL DEFAULT '{}',
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "automationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistConversation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistAutomation" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "weekday" INTEGER,
    "time" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "emailResult" BOOLEAN NOT NULL DEFAULT true,
    "nextRunAt" TIMESTAMP(3) NOT NULL,
    "lastRunAt" TIMESTAMP(3),
    "lastStatus" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistAutomation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssistUsage" (
    "agencyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheReadTokens" INTEGER NOT NULL DEFAULT 0,
    "cacheWriteTokens" INTEGER NOT NULL DEFAULT 0,
    "costMicros" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssistUsage_pkey" PRIMARY KEY ("agencyId","month","userId")
);

-- CreateTable
CREATE TABLE "Integration" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "IntegrationStatus" NOT NULL DEFAULT 'CONNECTED',
    "config" JSONB NOT NULL DEFAULT '{}',
    "secrets" TEXT,
    "connectedById" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Integration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntegrationLog" (
    "id" TEXT NOT NULL,
    "integrationId" TEXT,
    "agencyId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "ok" BOOLEAN NOT NULL,
    "detail" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BankHoliday" (
    "division" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "BankHoliday_pkey" PRIMARY KEY ("division","date")
);

-- CreateTable
CREATE TABLE "SmsMessage" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT,
    "offerId" TEXT,
    "direction" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "code" TEXT,
    "providerId" TEXT,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemHeartbeat" (
    "key" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL,
    "detail" TEXT,

    CONSTRAINT "SystemHeartbeat_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ServiceKey" (
    "name" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ServiceKey_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "ElementsEvent" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "needsAttention" BOOLEAN NOT NULL DEFAULT false,
    "urgent" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),
    "resolvedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ElementsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayAddition" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "payrollRunId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayAddition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUnavailability" (
    "id" TEXT NOT NULL,
    "agencyId" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "weekday" INTEGER,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUnavailability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimesheetReminder" (
    "id" TEXT NOT NULL,
    "timesheetId" TEXT NOT NULL,
    "day" INTEGER NOT NULL,
    "sentTo" TEXT NOT NULL,
    "delivered" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimesheetReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Agency_slug_key" ON "Agency"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_aultrumSub_idx" ON "User"("aultrumSub");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE INDEX "StaffProfile_agencyId_status_idx" ON "StaffProfile"("agencyId", "status");

-- CreateIndex
CREATE INDEX "StaffProfile_aultrumSub_idx" ON "StaffProfile"("aultrumSub");

-- CreateIndex
CREATE INDEX "Client_agencyId_status_idx" ON "Client"("agencyId", "status");

-- CreateIndex
CREATE INDEX "ClientContact_clientId_idx" ON "ClientContact"("clientId");

-- CreateIndex
CREATE INDEX "ClientRate_clientId_idx" ON "ClientRate"("clientId");

-- CreateIndex
CREATE INDEX "Site_agencyId_idx" ON "Site"("agencyId");

-- CreateIndex
CREATE INDEX "Site_clientId_idx" ON "Site"("clientId");

-- CreateIndex
CREATE INDEX "Shift_agencyId_startAt_idx" ON "Shift"("agencyId", "startAt");

-- CreateIndex
CREATE INDEX "Shift_agencyId_status_idx" ON "Shift"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Shift_staffId_startAt_idx" ON "Shift"("staffId", "startAt");

-- CreateIndex
CREATE INDEX "Shift_rotaTemplateId_idx" ON "Shift"("rotaTemplateId");

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

-- CreateIndex
CREATE INDEX "ShiftComment_shiftId_idx" ON "ShiftComment"("shiftId");

-- CreateIndex
CREATE INDEX "StaffDocument_staffId_status_idx" ON "StaffDocument"("staffId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "RightToWork_staffId_key" ON "RightToWork"("staffId");

-- CreateIndex
CREATE INDEX "RightToWork_agencyId_status_idx" ON "RightToWork"("agencyId", "status");

-- CreateIndex
CREATE INDEX "TrainingRecord_staffId_status_idx" ON "TrainingRecord"("staffId", "status");

-- CreateIndex
CREATE INDEX "OnboardingForm_staffId_status_idx" ON "OnboardingForm"("staffId", "status");

-- CreateIndex
CREATE INDEX "PushMessageLog_agencyId_staffId_idx" ON "PushMessageLog"("agencyId", "staffId");

-- CreateIndex
CREATE UNIQUE INDEX "PleasantLinkToken_token_key" ON "PleasantLinkToken"("token");

-- CreateIndex
CREATE INDEX "PleasantLinkToken_token_idx" ON "PleasantLinkToken"("token");

-- CreateIndex
CREATE INDEX "ClientComplaint_agencyId_clientId_idx" ON "ClientComplaint"("agencyId", "clientId");

-- CreateIndex
CREATE UNIQUE INDEX "ClientConfidenceRating_clientId_key" ON "ClientConfidenceRating"("clientId");

-- CreateIndex
CREATE INDEX "AgentTask_agencyId_status_idx" ON "AgentTask"("agencyId", "status");

-- CreateIndex
CREATE INDEX "AgentLog_agencyId_agentName_idx" ON "AgentLog"("agencyId", "agentName");

-- CreateIndex
CREATE INDEX "PushbotCampaign_agencyId_status_idx" ON "PushbotCampaign"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_agencyId_status_idx" ON "Invoice"("agencyId", "status");

-- CreateIndex
CREATE INDEX "Invoice_clientId_periodStart_idx" ON "Invoice"("clientId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_agencyId_reference_key" ON "Invoice"("agencyId", "reference");

-- CreateIndex
CREATE INDEX "InvoiceLine_invoiceId_idx" ON "InvoiceLine"("invoiceId");

-- CreateIndex
CREATE INDEX "InvoiceLine_staffId_date_idx" ON "InvoiceLine"("staffId", "date");

-- CreateIndex
CREATE INDEX "RotaTemplate_agencyId_idx" ON "RotaTemplate"("agencyId");

-- CreateIndex
CREATE INDEX "RotaTemplateLine_templateId_idx" ON "RotaTemplateLine"("templateId");

-- CreateIndex
CREATE INDEX "ShiftOffer_staffId_status_idx" ON "ShiftOffer"("staffId", "status");

-- CreateIndex
CREATE INDEX "ShiftOffer_agencyId_status_idx" ON "ShiftOffer"("agencyId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "ShiftOffer_shiftId_staffId_key" ON "ShiftOffer"("shiftId", "staffId");

-- CreateIndex
CREATE INDEX "ImportSession_agencyId_createdAt_idx" ON "ImportSession"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AgencyAddon_agencyId_idx" ON "AgencyAddon"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "AgencyAddon_agencyId_key_key" ON "AgencyAddon"("agencyId", "key");

-- CreateIndex
CREATE INDEX "AuditEvent_agencyId_createdAt_idx" ON "AuditEvent"("agencyId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditEvent_agencyId_action_idx" ON "AuditEvent"("agencyId", "action");

-- CreateIndex
CREATE INDEX "AssistConversation_userId_updatedAt_idx" ON "AssistConversation"("userId", "updatedAt");

-- CreateIndex
CREATE INDEX "AssistConversation_automationId_createdAt_idx" ON "AssistConversation"("automationId", "createdAt");

-- CreateIndex
CREATE INDEX "AssistAutomation_enabled_nextRunAt_idx" ON "AssistAutomation"("enabled", "nextRunAt");

-- CreateIndex
CREATE INDEX "AssistAutomation_userId_idx" ON "AssistAutomation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Integration_agencyId_provider_key" ON "Integration"("agencyId", "provider");

-- CreateIndex
CREATE INDEX "IntegrationLog_agencyId_provider_createdAt_idx" ON "IntegrationLog"("agencyId", "provider", "createdAt");

-- CreateIndex
CREATE INDEX "SmsMessage_agencyId_phone_createdAt_idx" ON "SmsMessage"("agencyId", "phone", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ElementsEvent_eventId_key" ON "ElementsEvent"("eventId");

-- CreateIndex
CREATE INDEX "ElementsEvent_agencyId_needsAttention_resolvedAt_idx" ON "ElementsEvent"("agencyId", "needsAttention", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PayAddition_sourceRef_key" ON "PayAddition"("sourceRef");

-- CreateIndex
CREATE INDEX "PayAddition_agencyId_payrollRunId_idx" ON "PayAddition"("agencyId", "payrollRunId");

-- CreateIndex
CREATE INDEX "StaffUnavailability_staffId_endsOn_idx" ON "StaffUnavailability"("staffId", "endsOn");

-- CreateIndex
CREATE INDEX "StaffUnavailability_agencyId_idx" ON "StaffUnavailability"("agencyId");

-- CreateIndex
CREATE UNIQUE INDEX "TimesheetReminder_timesheetId_day_key" ON "TimesheetReminder"("timesheetId", "day");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientContact" ADD CONSTRAINT "ClientContact_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRate" ADD CONSTRAINT "ClientRate_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRate" ADD CONSTRAINT "ClientRate_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientRate" ADD CONSTRAINT "ClientRate_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Site" ADD CONSTRAINT "Site_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "Shift" ADD CONSTRAINT "Shift_rotaTemplateId_fkey" FOREIGN KEY ("rotaTemplateId") REFERENCES "RotaTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "ShiftComment" ADD CONSTRAINT "ShiftComment_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftComment" ADD CONSTRAINT "ShiftComment_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftComment" ADD CONSTRAINT "ShiftComment_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftComment" ADD CONSTRAINT "ShiftComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDocument" ADD CONSTRAINT "StaffDocument_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightToWork" ADD CONSTRAINT "RightToWork_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightToWork" ADD CONSTRAINT "RightToWork_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightToWork" ADD CONSTRAINT "RightToWork_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingRecord" ADD CONSTRAINT "TrainingRecord_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingForm" ADD CONSTRAINT "OnboardingForm_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingForm" ADD CONSTRAINT "OnboardingForm_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingForm" ADD CONSTRAINT "OnboardingForm_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushMessageLog" ADD CONSTRAINT "PushMessageLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushMessageLog" ADD CONSTRAINT "PushMessageLog_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PleasantLinkToken" ADD CONSTRAINT "PleasantLinkToken_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PleasantLinkToken" ADD CONSTRAINT "PleasantLinkToken_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PleasantLinkToken" ADD CONSTRAINT "PleasantLinkToken_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "ClientContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientComplaint" ADD CONSTRAINT "ClientComplaint_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientComplaint" ADD CONSTRAINT "ClientComplaint_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientComplaint" ADD CONSTRAINT "ClientComplaint_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientComplaint" ADD CONSTRAINT "ClientComplaint_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConfidenceRating" ADD CONSTRAINT "ClientConfidenceRating_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClientConfidenceRating" ADD CONSTRAINT "ClientConfidenceRating_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentTask" ADD CONSTRAINT "AgentTask_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentLog" ADD CONSTRAINT "AgentLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushbotCampaign" ADD CONSTRAINT "PushbotCampaign_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushbotCampaign" ADD CONSTRAINT "PushbotCampaign_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushbotCampaign" ADD CONSTRAINT "PushbotCampaign_claimedById_fkey" FOREIGN KEY ("claimedById") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaTemplate" ADD CONSTRAINT "RotaTemplate_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaTemplateLine" ADD CONSTRAINT "RotaTemplateLine_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "RotaTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaTemplateLine" ADD CONSTRAINT "RotaTemplateLine_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaTemplateLine" ADD CONSTRAINT "RotaTemplateLine_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RotaTemplateLine" ADD CONSTRAINT "RotaTemplateLine_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "Shift"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShiftOffer" ADD CONSTRAINT "ShiftOffer_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportSession" ADD CONSTRAINT "ImportSession_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgencyAddon" ADD CONSTRAINT "AgencyAddon_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditEvent" ADD CONSTRAINT "AuditEvent_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistConversation" ADD CONSTRAINT "AssistConversation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistConversation" ADD CONSTRAINT "AssistConversation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistConversation" ADD CONSTRAINT "AssistConversation_automationId_fkey" FOREIGN KEY ("automationId") REFERENCES "AssistAutomation"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistAutomation" ADD CONSTRAINT "AssistAutomation_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistAutomation" ADD CONSTRAINT "AssistAutomation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssistUsage" ADD CONSTRAINT "AssistUsage_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Integration" ADD CONSTRAINT "Integration_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntegrationLog" ADD CONSTRAINT "IntegrationLog_integrationId_fkey" FOREIGN KEY ("integrationId") REFERENCES "Integration"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsMessage" ADD CONSTRAINT "SmsMessage_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ElementsEvent" ADD CONSTRAINT "ElementsEvent_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayAddition" ADD CONSTRAINT "PayAddition_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayAddition" ADD CONSTRAINT "PayAddition_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayAddition" ADD CONSTRAINT "PayAddition_payrollRunId_fkey" FOREIGN KEY ("payrollRunId") REFERENCES "PayrollRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUnavailability" ADD CONSTRAINT "StaffUnavailability_agencyId_fkey" FOREIGN KEY ("agencyId") REFERENCES "Agency"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffUnavailability" ADD CONSTRAINT "StaffUnavailability_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimesheetReminder" ADD CONSTRAINT "TimesheetReminder_timesheetId_fkey" FOREIGN KEY ("timesheetId") REFERENCES "Timesheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

