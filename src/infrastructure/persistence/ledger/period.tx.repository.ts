import type { Prisma } from '@prisma/client';
import { parseMoney } from '@/domain/money.js';
import type { AccountBalance } from '@/domain/reports/ledger-rows.js';
import type {
    IPeriodTxRepository,
    PeriodClosingRow,
} from '@/domain/repositories/ledger.unit-of-work.interface.js';

interface BalanceRow {
    accountId: string;
    debit: string;
    credit: string;
}

export class PeriodTxRepository implements IPeriodTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async lockCompany(companyId: string): Promise<{ closedThrough: Date | null } | null> {
        const rows = await this.client.$queryRaw<{ closedThrough: Date | null }[]>`
            SELECT "closedThrough" FROM "Company" WHERE "id" = ${companyId} FOR UPDATE`;
        return rows[0] ?? null;
    }

    latest(companyId: string): Promise<PeriodClosingRow | null> {
        return this.client.periodClosing.findFirst({
            where: { companyId },
            orderBy: { throughDate: 'desc' },
        });
    }

    async insert(row: PeriodClosingRow): Promise<void> {
        await this.client.periodClosing.create({ data: row });
    }

    async delete(id: string): Promise<void> {
        await this.client.periodClosing.delete({ where: { id } });
    }

    async setClosedThrough(companyId: string, date: Date | null): Promise<void> {
        await this.client.company.update({
            where: { id: companyId },
            data: { closedThrough: date },
        });
    }

    async resultBalances(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
    ): Promise<AccountBalance[]> {
        const rows = await this.client.$queryRaw<BalanceRow[]>`
            SELECT l."accountId" AS "accountId",
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
            GROUP BY l."accountId"`;
        return rows.map(row => ({
            accountId: row.accountId,
            debit: parseMoney(row.debit),
            credit: parseMoney(row.credit),
        }));
    }
}
