-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ANALYTIC', 'SYNTHETIC');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "cnae" TEXT NOT NULL,
ADD COLUMN     "cnpj" TEXT NOT NULL,
ADD COLUMN     "email" TEXT NOT NULL,
ADD COLUMN     "logoUrl" TEXT,
ADD COLUMN     "openingDate" DATE NOT NULL,
ADD COLUMN     "phone" TEXT NOT NULL,
ADD COLUMN     "socialReason" TEXT NOT NULL,
ADD COLUMN     "taxRegime" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "CompanyAddress" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "zipCode" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "neighborhood" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,

    CONSTRAINT "CompanyAddress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingPlan" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingAccount" (
    "id" TEXT NOT NULL,
    "billingPlanId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "code" TEXT NOT NULL,
    "sortKey" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BillingAccount_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAddress_companyId_key" ON "CompanyAddress"("companyId");

-- CreateIndex
CREATE INDEX "BillingPlan_companyId_name_idx" ON "BillingPlan"("companyId", "name");

-- CreateIndex
CREATE INDEX "BillingAccount_billingPlanId_parentId_idx" ON "BillingAccount"("billingPlanId", "parentId");

-- CreateIndex
CREATE INDEX "BillingAccount_billingPlanId_sortKey_idx" ON "BillingAccount"("billingPlanId", "sortKey");

-- CreateIndex
CREATE INDEX "BillingAccount_accountType_idx" ON "BillingAccount"("accountType");

-- CreateIndex
CREATE UNIQUE INDEX "BillingAccount_billingPlanId_code_key" ON "BillingAccount"("billingPlanId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Company_cnpj_key" ON "Company"("cnpj");

-- CreateIndex
CREATE INDEX "Company_isActive_name_idx" ON "Company"("isActive", "name");

-- AddForeignKey
ALTER TABLE "CompanyAddress" ADD CONSTRAINT "CompanyAddress_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingPlan" ADD CONSTRAINT "BillingPlan_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_billingPlanId_fkey" FOREIGN KEY ("billingPlanId") REFERENCES "BillingPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "BillingAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- AddCheckConstraint
ALTER TABLE "BillingAccount" ADD CONSTRAINT "BillingAccount_level_check" CHECK ("level" BETWEEN 1 AND 5);
