-- AlterTable
ALTER TABLE "BillingPlan" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- O plano mais antigo de cada empresa vira o padrão.
UPDATE "BillingPlan" SET "isDefault" = true
WHERE "id" IN (
    SELECT DISTINCT ON ("companyId") "id" FROM "BillingPlan" ORDER BY "companyId", "createdAt", "id"
);

-- No máximo um plano padrão por empresa.
CREATE UNIQUE INDEX "BillingPlan_companyId_default_key" ON "BillingPlan" ("companyId") WHERE "isDefault";
