import type { AccountNature } from '@/domain/billing/account-nature.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/**
 * Define a natureza da conta nova: a raiz exige uma; a filha herda a do pai.
 * @throws DomainError ACCOUNT_NATURE_REQUIRED, ACCOUNT_NATURE_MISMATCH
 */
export function resolveNature(
    parentNature: AccountNature | null,
    requested: AccountNature | undefined,
): AccountNature {
    if (parentNature === null) {
        if (requested === undefined) {
            throw new DomainError(
                ErrorCode.ACCOUNT_NATURE_REQUIRED,
                'A natureza é obrigatória para contas de nível 1',
            );
        }
        return requested;
    }
    if (requested !== undefined && requested !== parentNature) {
        throw new DomainError(
            ErrorCode.ACCOUNT_NATURE_MISMATCH,
            'A natureza da conta deve ser a mesma da conta pai',
        );
    }
    return parentNature;
}
