import type { AccountNature } from '@/domain/billing/account-nature.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import type { ErrorCode } from '@/domain/errors/error-codes.js';

export interface CategoryRules<C extends string> {
    /**
     * Garante que a categoria é aceita para a natureza (sem categoria sempre vale).
     * @throws DomainError com o código da classificação
     */
    assert(nature: AccountNature, category: C | null): void;
    /** Categoria da conta nova: a informada (`null` = sem categoria) ou, se omitida, a do pai. */
    resolve(
        nature: AccountNature,
        parentCategory: C | null,
        requested: C | null | undefined,
    ): C | null;
    /** Categoria usada no relatório: a da conta ou o padrão da natureza. */
    effective(nature: AccountNature, category: C | null): C | null;
}

/** Regras de uma classificação de contas: categorias aceitas e padrão por natureza. */
export function categoryRules<C extends string>(params: {
    allowed: Record<AccountNature, readonly C[]>;
    defaults: Partial<Record<AccountNature, C>>;
    errorCode: ErrorCode;
    label: string;
}): CategoryRules<C> {
    const assert = (nature: AccountNature, category: C | null): void => {
        if (category !== null && !params.allowed[nature].includes(category)) {
            throw new DomainError(
                params.errorCode,
                `A ${params.label} ${category} não é válida para contas de natureza ${nature}`,
            );
        }
    };
    return {
        assert,
        resolve(nature, parentCategory, requested) {
            const category = requested === undefined ? parentCategory : requested;
            assert(nature, category);
            return category;
        },
        effective(nature, category) {
            return category ?? params.defaults[nature] ?? null;
        },
    };
}
