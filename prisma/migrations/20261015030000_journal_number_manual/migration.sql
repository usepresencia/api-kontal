-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "JournalRefType" ADD VALUE 'MANUAL';
ALTER TYPE "JournalRefType" ADD VALUE 'MANUAL_REVERSAL';

-- AlterTable
ALTER TABLE "JournalEntry" ADD COLUMN     "number" BIGSERIAL NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_number_key" ON "JournalEntry"("number");

-- CreateIndex
CREATE INDEX "JournalEntry_companyId_date_number_idx" ON "JournalEntry"("companyId", "date", "number");

