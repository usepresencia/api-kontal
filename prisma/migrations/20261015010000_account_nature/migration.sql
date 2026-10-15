-- CreateEnum
CREATE TYPE "AccountNature" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- AlterTable
ALTER TABLE "BillingAccount" ADD COLUMN     "nature" "AccountNature" NOT NULL;

-- CreateIndex
CREATE INDEX "BillingAccount_billingPlanId_nature_idx" ON "BillingAccount"("billingPlanId", "nature");

