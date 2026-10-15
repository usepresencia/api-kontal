-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalRefType" ADD VALUE 'CLOSING';
ALTER TYPE "JournalRefType" ADD VALUE 'CLOSING_REVERSAL';

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "closedThrough" DATE;

-- CreateTable
CREATE TABLE "PeriodClosing" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "throughDate" DATE NOT NULL,
    "closingEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PeriodClosing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PeriodClosing_companyId_throughDate_key" ON "PeriodClosing"("companyId", "throughDate");

-- AddForeignKey
ALTER TABLE "PeriodClosing" ADD CONSTRAINT "PeriodClosing_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

