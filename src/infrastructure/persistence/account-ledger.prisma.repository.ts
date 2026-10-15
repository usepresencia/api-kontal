import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import { parseMoney } from '@/domain/money.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type { LedgerDayRow, LedgerItemRow, LedgerTotals } from '@/domain/reports/account-ledger.js';
import type { IAccountLedgerRepository } from '@/domain/repositories/account-ledger.repository.interface.js';
import type { AccountLabel } from '@/domain/repositories/journal-read.repository.interface.js';
import { signedCents } from '@/infrastructure/persistence/money.mapper.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';

interface TotalsRow {
    openingDebit: string;
    openingCredit: string;
    debit: string;
    credit: string;
}

interface ItemRow {
    journalEntryId: string;
    number: string;
    date: Date;
    description: string;
    referenceType: JournalRefType;
    debit: string;
    credit: string;
    running: string;
}

interface DayRow {
    date: Date;
    debit: string;
    credit: string;
}

@Injectable()
export class AccountLedgerPrismaRepository implements IAccountLedgerRepository {
    constructor(private readonly prisma: PrismaService) {}

    async totals(
        companyId: string,
        accountIds: readonly string[],
        start: Date,
        end: Date,
    ): Promise<LedgerTotals> {
        const [row] = await this.prisma.$queryRaw<TotalsRow[]>`
            SELECT COALESCE(SUM(l."debit") FILTER (WHERE j."date" < ${start}), 0)::text AS "openingDebit",
                   COALESCE(SUM(l."credit") FILTER (WHERE j."date" < ${start}), 0)::text AS "openingCredit",
                   COALESCE(SUM(l."debit") FILTER (WHERE j."date" >= ${start}), 0)::text AS "debit",
                   COALESCE(SUM(l."credit") FILTER (WHERE j."date" >= ${start}), 0)::text AS "credit"
            FROM "JournalLine" l
            JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
            WHERE j."companyId" = ${companyId}
              AND l."accountId" IN (${Prisma.join([...accountIds])})
              AND j."date" <= ${end}`;
        return {
            openingDebit: parseMoney(row.openingDebit),
            openingCredit: parseMoney(row.openingCredit),
            debit: parseMoney(row.debit),
            credit: parseMoney(row.credit),
        };
    }

    async items(
        companyId: string,
        accountIds: readonly string[],
        start: Date,
        end: Date,
        page: PageRequest,
    ): Promise<Page<LedgerItemRow>> {
        const ids = Prisma.join([...accountIds]);
        const [rows, [count]] = await Promise.all([
            this.prisma.$queryRaw<ItemRow[]>`
                WITH moves AS (
                    SELECT j."id", j."number", j."date", j."description", j."referenceType",
                           SUM(l."debit") AS "debit", SUM(l."credit") AS "credit"
                    FROM "JournalLine" l
                    JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
                    WHERE j."companyId" = ${companyId}
                      AND l."accountId" IN (${ids})
                      AND j."date" >= ${start}
                      AND j."date" <= ${end}
                    GROUP BY j."id"
                )
                SELECT "id" AS "journalEntryId", "number"::text AS "number", "date", "description",
                       "referenceType"::text AS "referenceType",
                       "debit"::text AS "debit", "credit"::text AS "credit",
                       (SUM("debit" - "credit") OVER (ORDER BY "date", "number"))::text AS "running"
                FROM moves
                ORDER BY "date", "number"
                LIMIT ${page.pageSize} OFFSET ${pageOffset(page)}`,
            this.prisma.$queryRaw<{ total: number }[]>`
                SELECT COUNT(DISTINCT j."id")::int AS "total"
                FROM "JournalLine" l
                JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
                WHERE j."companyId" = ${companyId}
                  AND l."accountId" IN (${ids})
                  AND j."date" >= ${start}
                  AND j."date" <= ${end}`,
        ]);
        const counterparts = await this.counterparts(
            rows.map(row => row.journalEntryId),
            accountIds,
        );
        return {
            items: rows.map(row => ({
                journalEntryId: row.journalEntryId,
                number: Number(row.number),
                date: row.date,
                description: row.description,
                referenceType: row.referenceType,
                debit: parseMoney(row.debit),
                credit: parseMoney(row.credit),
                running: signedCents(row.running),
                counterparts: counterparts.get(row.journalEntryId) ?? [],
            })),
            page: page.page,
            pageSize: page.pageSize,
            total: count.total,
        };
    }

    async days(
        companyId: string,
        accountIds: readonly string[],
        start: Date,
        end: Date,
    ): Promise<LedgerDayRow[]> {
        const rows = await this.prisma.$queryRaw<DayRow[]>`
            SELECT j."date" AS "date", SUM(l."debit")::text AS "debit", SUM(l."credit")::text AS "credit"
            FROM "JournalLine" l
            JOIN "JournalEntry" j ON j."id" = l."journalEntryId"
            WHERE j."companyId" = ${companyId}
              AND l."accountId" IN (${Prisma.join([...accountIds])})
              AND j."date" >= ${start}
              AND j."date" <= ${end}
            GROUP BY j."date"
            ORDER BY j."date"`;
        return rows.map(row => ({
            date: row.date,
            debit: parseMoney(row.debit),
            credit: parseMoney(row.credit),
        }));
    }

    /** Contas das outras linhas de cada lançamento, sem repetição, na ordem do plano. */
    private async counterparts(
        entryIds: readonly string[],
        accountIds: readonly string[],
    ): Promise<Map<string, AccountLabel[]>> {
        const result = new Map<string, AccountLabel[]>();
        if (entryIds.length === 0) return result;
        const lines = await this.prisma.journalLine.findMany({
            where: { journalEntryId: { in: [...entryIds] }, accountId: { notIn: [...accountIds] } },
            select: { journalEntryId: true, account: { select: { code: true, name: true } } },
            orderBy: { account: { sortKey: 'asc' } },
        });
        for (const line of lines) {
            const labels = result.get(line.journalEntryId) ?? [];
            if (!labels.some(label => label.code === line.account.code)) labels.push(line.account);
            result.set(line.journalEntryId, labels);
        }
        return result;
    }
}
