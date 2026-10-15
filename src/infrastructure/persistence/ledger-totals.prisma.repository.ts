import { Injectable } from '@nestjs/common';
import { parseMoney } from '@/domain/money.js';
import type { ILedgerTotalsRepository } from '@/domain/repositories/ledger-totals.repository.interface.js';
import type {
    AccountBalance,
    MonthlyMovement,
    TrialBalanceRow,
} from '@/domain/reports/ledger-rows.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

interface MonthlyRow {
    accountId: string;
    month: string;
    debit: string;
    credit: string;
}

interface TrialRow {
    accountId: string;
    openingDebit: string;
    openingCredit: string;
    debit: string;
    credit: string;
}

interface BalanceRow {
    accountId: string;
    debit: string;
    credit: string;
}

@Injectable()
export class LedgerTotalsPrismaRepository implements ILedgerTotalsRepository {
    constructor(private readonly prisma: PrismaService) {}

    async monthlyMovements(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<MonthlyMovement[]> {
        const rows = await this.prisma.$queryRaw<MonthlyRow[]>`
            SELECT l."accountId" AS "accountId",
                   to_char(j."date", 'YYYY-MM') AS "month",
                   SUM(l."debit")::text AS "debit",
                   SUM(l."credit")::text AS "credit"
            FROM "JournalLine" l
            JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
            JOIN "BillingAccount" a ON a."id" = l."accountId"
            WHERE j."companyId" = ${companyId}
              AND a."billingPlanId" = ${planId}
              AND a."nature" IN ('REVENUE', 'EXPENSE')
              AND j."referenceType" NOT IN ('CLOSING', 'CLOSING_REVERSAL')
              AND j."date" >= ${start}
              AND j."date" <= ${end}
            GROUP BY l."accountId", to_char(j."date", 'YYYY-MM')`;
        return rows.map(row => ({
            accountId: row.accountId,
            month: row.month,
            debit: parseMoney(row.debit),
            credit: parseMoney(row.credit),
        }));
    }

    async trialBalance(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<TrialBalanceRow[]> {
        const rows = await this.prisma.$queryRaw<TrialRow[]>`
            SELECT l."accountId" AS "accountId",
                   COALESCE(SUM(l."debit") FILTER (WHERE j."date" < ${start}), 0)::text AS "openingDebit",
                   COALESCE(SUM(l."credit") FILTER (WHERE j."date" < ${start}), 0)::text AS "openingCredit",
                   COALESCE(SUM(l."debit") FILTER (WHERE j."date" >= ${start}), 0)::text AS "debit",
                   COALESCE(SUM(l."credit") FILTER (WHERE j."date" >= ${start}), 0)::text AS "credit"
            FROM "JournalLine" l
            JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
            JOIN "BillingAccount" a ON a."id" = l."accountId"
            WHERE j."companyId" = ${companyId}
              AND a."billingPlanId" = ${planId}
              AND j."date" <= ${end}
            GROUP BY l."accountId"`;
        return rows.map(row => ({
            accountId: row.accountId,
            openingDebit: parseMoney(row.openingDebit),
            openingCredit: parseMoney(row.openingCredit),
            debit: parseMoney(row.debit),
            credit: parseMoney(row.credit),
        }));
    }

    async balancesUntil(companyId: string, planId: string, date: Date): Promise<AccountBalance[]> {
        const rows = await this.prisma.$queryRaw<BalanceRow[]>`
            SELECT l."accountId" AS "accountId",
                   SUM(l."debit")::text AS "debit",
                   SUM(l."credit")::text AS "credit"
            FROM "JournalLine" l
            JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
            JOIN "BillingAccount" a ON a."id" = l."accountId"
            WHERE j."companyId" = ${companyId}
              AND a."billingPlanId" = ${planId}
              AND j."date" <= ${date}
            GROUP BY l."accountId"`;
        return rows.map(row => ({
            accountId: row.accountId,
            debit: parseMoney(row.debit),
            credit: parseMoney(row.credit),
        }));
    }
}
