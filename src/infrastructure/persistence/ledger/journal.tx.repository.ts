import type { Prisma } from '@prisma/client';
import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import { assertPeriodOpen, LOCK_EXEMPT_TYPES } from '@/domain/ledger/period-lock.policy.js';
import type { IJournalTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    toJournalData,
    toJournalEntity,
} from '@/infrastructure/persistence/journal.prisma.mapper.js';
import { isUniqueConstraintError } from '@/utils/prisma.utils.js';

export class JournalTxRepository implements IJournalTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async find(
        referenceType: JournalRefType,
        referenceId: string,
    ): Promise<JournalEntryEntity | null> {
        const row = await this.client.journalEntry.findUnique({
            where: { referenceType_referenceId: { referenceType, referenceId } },
            include: { lines: true },
        });
        return row ? toJournalEntity(row) : null;
    }

    async findAll(
        referenceType: JournalRefType,
        referenceIds: readonly string[],
    ): Promise<JournalEntryEntity[]> {
        if (referenceIds.length === 0) return [];
        const rows = await this.client.journalEntry.findMany({
            where: { referenceType, referenceId: { in: [...referenceIds] } },
            include: { lines: true },
        });
        return rows.map(toJournalEntity);
    }

    async lock(companyId: string, id: string): Promise<JournalEntryEntity | null> {
        const rows = await this.client.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "JournalEntry" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
        if (rows.length === 0) return null;
        return toJournalEntity(
            await this.client.journalEntry.findUniqueOrThrow({
                where: { id },
                include: { lines: true },
            }),
        );
    }

    async closedThrough(companyId: string): Promise<Date | null> {
        const rows = await this.client.$queryRaw<{ closedThrough: Date | null }[]>`
            SELECT "closedThrough" FROM "Company" WHERE "id" = ${companyId} FOR KEY SHARE`;
        return rows[0]?.closedThrough ?? null;
    }

    async earliestDate(companyId: string): Promise<Date | null> {
        const rows = await this.client.$queryRaw<{ date: Date | null }[]>`
            SELECT MIN("date") AS "date" FROM "JournalEntry" WHERE "companyId" = ${companyId}`;
        return rows[0]?.date ?? null;
    }

    async writeAll(entries: readonly JournalEntryEntity[]): Promise<void> {
        if (entries.length === 0) return;
        const guarded = entries.filter(entry => !LOCK_EXEMPT_TYPES.includes(entry.referenceType));
        for (const companyId of new Set(guarded.map(entry => entry.companyId))) {
            assertPeriodOpen(
                await this.closedThrough(companyId),
                guarded.filter(entry => entry.companyId === companyId).map(entry => entry.date),
            );
        }
        const data = entries.map(toJournalData);
        try {
            await this.client.journalEntry.createMany({ data: data.map(item => item.entry) });
            await this.client.journalLine.createMany({ data: data.flatMap(item => item.lines) });
        } catch (err) {
            if (isUniqueConstraintError(err)) {
                throw new DomainError(
                    ErrorCode.CONFLICT,
                    'Já existe lançamento contábil para este evento',
                );
            }
            throw err;
        }
    }
}
