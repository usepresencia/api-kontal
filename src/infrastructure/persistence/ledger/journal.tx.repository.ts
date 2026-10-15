import type { Prisma } from '@prisma/client';
import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
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

    async writeAll(entries: readonly JournalEntryEntity[]): Promise<void> {
        if (entries.length === 0) return;
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
