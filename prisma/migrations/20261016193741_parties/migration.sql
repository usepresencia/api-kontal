/*
  Warnings:

  - Added the required column `partyId` to the `Title` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PartyKind" AS ENUM ('CLIENT', 'SUPPLIER', 'BOTH');

-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "partyId" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "Party" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" "PartyKind" NOT NULL,
    "name" TEXT NOT NULL,
    "socialReason" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "zipCode" TEXT,
    "street" TEXT,
    "number" TEXT,
    "complement" TEXT,
    "neighborhood" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultPresetId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Party_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Party_companyId_kind_isActive_idx" ON "Party"("companyId", "kind", "isActive");

-- CreateIndex
CREATE INDEX "Party_defaultPresetId_idx" ON "Party"("defaultPresetId");

-- CreateIndex
CREATE UNIQUE INDEX "Party_companyId_document_key" ON "Party"("companyId", "document");

-- CreateIndex
CREATE INDEX "Title_partyId_idx" ON "Title"("partyId");

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Party" ADD CONSTRAINT "Party_defaultPresetId_fkey" FOREIGN KEY ("defaultPresetId") REFERENCES "Preset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_partyId_fkey" FOREIGN KEY ("partyId") REFERENCES "Party"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
