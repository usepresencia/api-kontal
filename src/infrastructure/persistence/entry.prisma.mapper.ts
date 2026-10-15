import type { Entry } from '@prisma/client';
import { EntryEntity } from '@/domain/entities/entry.entity.js';
import { toCents, toDecimal } from '@/infrastructure/persistence/money.mapper.js';

export function toEntryEntity(row: Entry): EntryEntity {
    return EntryEntity.fromPersistence({
        id: row.id,
        titleId: row.titleId,
        kind: row.kind,
        billingAccountId: row.billingAccountId,
        principalAmount: toCents(row.principalAmount),
        interestAmount: toCents(row.interestAmount),
        fineAmount: toCents(row.fineAmount),
        discountAmount: toCents(row.discountAmount),
        totalAmount: toCents(row.totalAmount),
        paidAt: row.paidAt,
        paymentMethod: row.paymentMethod,
        description: row.description,
        createdAt: row.createdAt,
    });
}

export function toEntryCreateData(entry: EntryEntity) {
    return {
        id: entry.id,
        titleId: entry.titleId,
        kind: entry.kind,
        billingAccountId: entry.billingAccountId,
        principalAmount: toDecimal(entry.principalAmount),
        interestAmount: toDecimal(entry.interestAmount),
        fineAmount: toDecimal(entry.fineAmount),
        discountAmount: toDecimal(entry.discountAmount),
        totalAmount: toDecimal(entry.totalAmount),
        paidAt: entry.paidAt,
        paymentMethod: entry.paymentMethod,
        description: entry.description,
        createdAt: entry.createdAt,
    };
}

/** Colunas que mudam depois da criação da baixa. */
export function toEntryUpdateData(entry: EntryEntity) {
    return { description: entry.description, paymentMethod: entry.paymentMethod };
}
