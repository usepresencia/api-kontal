-- AlterEnum
ALTER TYPE "PresetRole" ADD VALUE 'openingBalance';

-- AlterTable
ALTER TABLE "Title" ADD COLUMN     "isOpening" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openingDate" DATE;


-- Implantação: a data existe se, e somente se, o título é de implantação
ALTER TABLE "Title" ADD CONSTRAINT "Title_opening_check"
  CHECK (("isOpening" AND "openingDate" IS NOT NULL) OR (NOT "isOpening" AND "openingDate" IS NULL));
