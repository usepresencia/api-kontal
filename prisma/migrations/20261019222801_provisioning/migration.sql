-- CreateEnum
CREATE TYPE "ProvisioningAction" AS ENUM ('GRANT', 'REVOKE');

-- CreateEnum
CREATE TYPE "ProvisioningStatus" AS ENUM ('DONE', 'FAILED');

-- CreateTable
CREATE TABLE "Provisioning" (
    "id" TEXT NOT NULL,
    "action" "ProvisioningAction" NOT NULL,
    "status" "ProvisioningStatus" NOT NULL,
    "email" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "role" "MembershipRole",
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Provisioning_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Provisioning_email_idx" ON "Provisioning"("email");

-- CreateIndex
CREATE INDEX "Provisioning_companyId_idx" ON "Provisioning"("companyId");
