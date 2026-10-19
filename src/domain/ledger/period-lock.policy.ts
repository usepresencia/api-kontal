import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';

/** Tipos de lançamento que a trava de período não recusa. */
export const LOCK_EXEMPT_TYPES: readonly JournalRefType[] = [
    JournalRefType.CLOSING,
    JournalRefType.CLOSING_REVERSAL,
];

function formatDate(date: Date): string {
    const [year, month, day] = date.toISOString().slice(0, 10).split('-');
    return `${day}/${month}/${year}`;
}

/**
 * Garante que nenhuma das datas cai em período fechado (data até `closedThrough`).
 * @throws DomainError PERIOD_CLOSED
 */
export function assertPeriodOpen(closedThrough: Date | null, dates: readonly Date[]): void {
    if (closedThrough === null) return;
    if (dates.some(date => date.getTime() <= closedThrough.getTime())) {
        throw new DomainError(
            ErrorCode.PERIOD_CLOSED,
            `O período até ${formatDate(closedThrough)} está fechado`,
        );
    }
}

/**
 * Garante que a baixa não foi paga em período fechado (não pode ser excluída).
 * @throws DomainError PERIOD_CLOSED
 */
export function assertPaymentDateOpen(paidAt: Date, closedThrough: Date | null): void {
    if (closedThrough !== null && paidAt.getTime() <= closedThrough.getTime()) {
        throw new DomainError(
            ErrorCode.PERIOD_CLOSED,
            `A baixa foi paga em período fechado (até ${formatDate(closedThrough)}); reabra o período para excluí-la`,
        );
    }
}
