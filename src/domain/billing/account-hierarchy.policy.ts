import { MAX_ACCOUNT_LEVEL } from '@/domain/billing/account-code.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

export interface ParentRef {
    accountType: AccountType;
    level: number;
}

/**
 * Valida onde a conta pode ficar na árvore e devolve o nível dela.
 * @throws DomainError se for analítica sem pai, com pai analítico ou acima de 5 níveis
 */
export function assertValidPlacement(accountType: AccountType, parent: ParentRef | null): number {
    if (!parent) {
        if (accountType === AccountType.ANALYTIC) {
            throw new DomainError(
                ErrorCode.ACCOUNT_ANALYTIC_REQUIRES_PARENT,
                'Conta analítica deve ter uma conta pai sintética',
            );
        }
        return 1;
    }
    if (parent.accountType === AccountType.ANALYTIC) {
        throw new DomainError(
            ErrorCode.ACCOUNT_PARENT_NOT_SYNTHETIC,
            'A conta pai não pode ser analítica',
        );
    }
    const level = parent.level + 1;
    if (level > MAX_ACCOUNT_LEVEL) {
        throw new DomainError(
            ErrorCode.ACCOUNT_MAX_DEPTH_EXCEEDED,
            `A profundidade máxima permitida é de ${MAX_ACCOUNT_LEVEL} níveis`,
        );
    }
    return level;
}

/**
 * Valida a troca de tipo de uma conta existente.
 * @throws DomainError se virar analítica sem pai ou com filhas
 */
export function assertCanChangeType(
    nextType: AccountType,
    hasParent: boolean,
    hasChildren: boolean,
): void {
    if (nextType !== AccountType.ANALYTIC) return;
    if (!hasParent) {
        throw new DomainError(
            ErrorCode.ACCOUNT_ANALYTIC_REQUIRES_PARENT,
            'Conta analítica deve ter uma conta pai sintética',
        );
    }
    if (hasChildren) {
        throw new DomainError(
            ErrorCode.ACCOUNT_HAS_CHILDREN,
            'Conta analítica não pode possuir contas filhas',
        );
    }
}
