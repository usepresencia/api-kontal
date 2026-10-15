import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/**
 * Garante que o início do período não é posterior ao fim.
 * @throws DomainError DATE_RANGE_INVALID
 */
export function assertDateRange(start: Date, end: Date): void {
    if (start.getTime() > end.getTime()) {
        throw new DomainError(
            ErrorCode.DATE_RANGE_INVALID,
            'A data inicial não pode ser posterior à data final',
        );
    }
}
