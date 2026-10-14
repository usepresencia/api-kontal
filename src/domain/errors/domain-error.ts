import type { ErrorCode } from '@/domain/errors/error-codes.js';

/** Erro de regra de negócio com código estável, independente de HTTP. */
export class DomainError extends Error {
    constructor(
        readonly code: ErrorCode,
        message: string,
    ) {
        super(message);
        this.name = 'DomainError';
    }
}
