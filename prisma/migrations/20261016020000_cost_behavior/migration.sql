-- CreateEnum
CREATE TYPE "CostBehavior" AS ENUM ('VARIABLE', 'FIXED', 'DEPRECIATION');

-- AlterTable
ALTER TABLE "BillingAccount" ADD COLUMN     "costBehavior" "CostBehavior";

