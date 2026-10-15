import type { Prisma } from '@prisma/client';
import { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import { toCents, toDecimal } from '@/infrastructure/persistence/money.mapper.js';

export type JournalWithLines = Prisma.JournalEntryGetPayload<{ include: { lines: true } }>;

/** Reidrata o lançamento (com valores em centavos) a partir do banco. */
export function toJournalEntity(row: JournalWithLines): JournalEntryEntity {
    return JournalEntryEntity.fromPersistence({
        id: row.id,
        companyId: row.companyId,
        date: row.date,
        description: row.description,
        referenceType: row.referenceType,
        referenceId: row.referenceId,
        totalDebits: toCents(row.totalDebits),
        totalCredits: toCents(row.totalCredits),
        lines: row.lines.map(line => ({
            accountId: line.accountId,
            debit: toCents(line.debit),
            credit: toCents(line.credit),
            memo: line.memo,
        })),
        createdAt: row.createdAt,
    });
}

/** Linhas de `JournalEntry` e de `JournalLine` prontas para o `createMany`. */
export function toJournalData(entry: JournalEntryEntity) {
    return {
        entry: {
            id: entry.id,
            companyId: entry.companyId,
            date: entry.date,
            description: entry.description,
            referenceType: entry.referenceType,
            referenceId: entry.referenceId,
            totalDebits: toDecimal(entry.totalDebits),
            totalCredits: toDecimal(entry.totalCredits),
            createdAt: entry.createdAt,
        },
        lines: entry.lines.map(line => ({
            journalEntryId: entry.id,
            accountId: line.accountId,
            debit: toDecimal(line.debit),
            credit: toDecimal(line.credit),
            memo: line.memo,
        })),
    };
}
