import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

const DAY_MS = 86_400_000;

/**
 * Garante que o início do período não é posterior ao fim e, se informado, que o período
 * (inclusivo) não passa de `maxDays` dias.
 * @throws DomainError DATE_RANGE_INVALID
 */
export function assertDateRange(start: Date, end: Date, maxDays?: number): void {
    if (start.getTime() > end.getTime()) {
        throw new DomainError(
            ErrorCode.DATE_RANGE_INVALID,
            'A data inicial não pode ser posterior à data final',
        );
    }
    const days = Math.round((end.getTime() - start.getTime()) / DAY_MS) + 1;
    if (maxDays !== undefined && days > maxDays) {
        throw new DomainError(
            ErrorCode.DATE_RANGE_INVALID,
            `O período não pode passar de ${maxDays} dias`,
        );
    }
}
