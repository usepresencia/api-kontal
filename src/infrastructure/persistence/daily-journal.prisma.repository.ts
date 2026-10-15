import { Injectable } from '@nestjs/common';
import { parseMoney } from '@/domain/money.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type { DayTotals } from '@/domain/reports/daily-journal.js';
import type { IDailyJournalRepository } from '@/domain/repositories/daily-journal.repository.interface.js';
import type { JournalView } from '@/domain/repositories/journal-read.repository.interface.js';
import { loadJournalViews } from '@/infrastructure/persistence/journal-view.prisma.loader.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

interface DayRow {
    date: Date;
    debits: string;
    credits: string;
}

@Injectable()
export class DailyJournalPrismaRepository implements IDailyJournalRepository {
    constructor(private readonly prisma: PrismaService) {}

    async days(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
        page: PageRequest,
    ): Promise<Page<DayTotals>> {
        const [rows, [count]] = await Promise.all([
            this.prisma.$queryRaw<DayRow[]>`
                SELECT j."date" AS "date",
                       SUM(l."debit")::text AS "debits",
                       SUM(l."credit")::text AS "credits"
                FROM "JournalLine" l
                JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
                JOIN "BillingAccount" a ON a."id" = l."accountId"
                WHERE j."companyId" = ${companyId}
                  AND a."billingPlanId" = ${planId}
                  AND j."date" >= ${start}
                  AND j."date" <= ${end}
                GROUP BY j."date"
                ORDER BY j."date"
                LIMIT ${page.pageSize} OFFSET ${pageOffset(page)}`,
            this.prisma.$queryRaw<{ total: number }[]>`
                SELECT COUNT(DISTINCT j."date")::int AS "total"
                FROM "JournalLine" l
                JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
                JOIN "BillingAccount" a ON a."id" = l."accountId"
                WHERE j."companyId" = ${companyId}
                  AND a."billingPlanId" = ${planId}
                  AND j."date" >= ${start}
                  AND j."date" <= ${end}`,
        ]);
        return {
            items: rows.map(row => ({
                date: row.date,
                debits: parseMoney(row.debits),
                credits: parseMoney(row.credits),
            })),
            page: page.page,
            pageSize: page.pageSize,
            total: count.total,
        };
    }

    async entriesOn(
        companyId: string,
        planId: string,
        dates: readonly Date[],
    ): Promise<JournalView[]> {
        if (dates.length === 0) return [];
        return loadJournalViews(this.prisma, {
            where: {
                companyId,
                date: { in: [...dates] },
                lines: { some: { account: { billingPlanId: planId } } },
            },
            orderBy: [{ date: 'asc' }, { number: 'asc' }],
        });
    }
}
