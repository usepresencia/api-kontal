-- CreateEnum
CREATE TYPE "PresetRole" AS ENUM ('receivable', 'payable', 'revenue', 'expense', 'interestIncome', 'discountGranted', 'badDebt', 'interestExpense', 'discountObtained', 'debtForgiveness');

-- CreateEnum
CREATE TYPE "TitleType" AS ENUM ('INCOME', 'EXPENSE');

-- CreateEnum
CREATE TYPE "TitleStatus" AS ENUM ('OPEN', 'SETTLED', 'WRITTEN_OFF');

-- CreateEnum
CREATE TYPE "EntryKind" AS ENUM ('PAYMENT', 'WRITE_OFF');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT', 'CREDIT', 'PIX');

-- CreateEnum
CREATE TYPE "SeriesKind" AS ENUM ('INSTALLMENT', 'RECURRING');

-- CreateEnum
CREATE TYPE "SeriesFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "JournalRefType" AS ENUM ('TITLE_CREATION', 'TITLE_CANCELLATION', 'SETTLEMENT', 'SETTLEMENT_REVERSAL');

-- CreateTable
CREATE TABLE "Preset" (
    "id" TEXT NOT NULL,
    "billingPlanId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Preset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PresetAccount" (
    "id" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "role" "PresetRole" NOT NULL,
    "accountId" TEXT NOT NULL,

    CONSTRAINT "PresetAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TitleSeries" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "SeriesKind" NOT NULL,
    "frequency" "SeriesFrequency" NOT NULL,
    "totalCount" INTEGER NOT NULL,
    "baseDescription" TEXT NOT NULL,
    "firstIssueDate" DATE NOT NULL,
    "firstExpirationDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TitleSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "presetId" TEXT NOT NULL,
    "controlAccountId" TEXT NOT NULL,
    "resultAccountId" TEXT NOT NULL,
    "seriesId" TEXT,
    "seriesIndex" INTEGER,
    "type" "TitleType" NOT NULL,
    "status" "TitleStatus" NOT NULL DEFAULT 'OPEN',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "settledAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "issueDate" DATE NOT NULL,
    "expirationDate" DATE NOT NULL,
    "feesPercentageMonthly" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "kind" "EntryKind" NOT NULL,
    "billingAccountId" TEXT,
    "principalAmount" DECIMAL(12,2) NOT NULL,
    "interestAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "fineAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAt" DATE NOT NULL,
    "paymentMethod" "PaymentMethod",
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "referenceType" "JournalRefType" NOT NULL,
    "referenceId" TEXT NOT NULL,
    "totalDebits" DECIMAL(14,2) NOT NULL,
    "totalCredits" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "memo" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Preset_billingPlanId_isActive_idx" ON "Preset"("billingPlanId", "isActive");

-- CreateIndex
CREATE INDEX "PresetAccount_accountId_idx" ON "PresetAccount"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "PresetAccount_presetId_role_key" ON "PresetAccount"("presetId", "role");

-- CreateIndex
CREATE INDEX "TitleSeries_companyId_kind_idx" ON "TitleSeries"("companyId", "kind");

-- CreateIndex
CREATE INDEX "Title_companyId_status_expirationDate_idx" ON "Title"("companyId", "status", "expirationDate");

-- CreateIndex
CREATE INDEX "Title_companyId_type_idx" ON "Title"("companyId", "type");

-- CreateIndex
CREATE INDEX "Title_presetId_idx" ON "Title"("presetId");

-- CreateIndex
CREATE INDEX "Title_seriesId_idx" ON "Title"("seriesId");

-- CreateIndex
CREATE INDEX "Title_controlAccountId_idx" ON "Title"("controlAccountId");

-- CreateIndex
CREATE INDEX "Title_resultAccountId_idx" ON "Title"("resultAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Title_seriesId_seriesIndex_key" ON "Title"("seriesId", "seriesIndex");

-- CreateIndex
CREATE INDEX "Entry_titleId_paidAt_idx" ON "Entry"("titleId", "paidAt");

-- CreateIndex
CREATE INDEX "Entry_billingAccountId_idx" ON "Entry"("billingAccountId");

-- CreateIndex
CREATE INDEX "JournalEntry_companyId_date_idx" ON "JournalEntry"("companyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_referenceType_referenceId_key" ON "JournalEntry"("referenceType", "referenceId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_journalEntryId_idx" ON "JournalLine"("accountId", "journalEntryId");

-- AddForeignKey
ALTER TABLE "Preset" ADD CONSTRAINT "Preset_billingPlanId_fkey" FOREIGN KEY ("billingPlanId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetAccount" ADD CONSTRAINT "PresetAccount_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PresetAccount" ADD CONSTRAINT "PresetAccount_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TitleSeries" ADD CONSTRAINT "TitleSeries_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_presetId_fkey" FOREIGN KEY ("presetId") REFERENCES "Preset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_controlAccountId_fkey" FOREIGN KEY ("controlAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_resultAccountId_fkey" FOREIGN KEY ("resultAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "TitleSeries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_billingAccountId_fkey" FOREIGN KEY ("billingAccountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddCheckConstraints
ALTER TABLE "Title" ADD CONSTRAINT "Title_amounts_check" CHECK ("amount" > 0 AND "settledAmount" >= 0 AND "settledAmount" <= "amount");
ALTER TABLE "Title" ADD CONSTRAINT "Title_fees_check" CHECK ("feesPercentageMonthly" BETWEEN 0 AND 1);
ALTER TABLE "Title" ADD CONSTRAINT "Title_series_check" CHECK (("seriesId" IS NULL) = ("seriesIndex" IS NULL));
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_amounts_check" CHECK ("principalAmount" > 0 AND "interestAmount" >= 0 AND "fineAmount" >= 0 AND "discountAmount" >= 0 AND "totalAmount" >= 0 AND ("kind" = 'WRITE_OFF' OR "billingAccountId" IS NOT NULL));
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_balance_check" CHECK ("totalDebits" = "totalCredits" AND "totalDebits" > 0);
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_side_check" CHECK (("debit" > 0 AND "credit" = 0) OR ("credit" > 0 AND "debit" = 0));
