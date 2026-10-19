import { ErrorCode } from '@/domain/errors/error-codes.js';
import { categoryRules } from '@/domain/billing/category-rules.js';

/** Grupos do balanço patrimonial (Lei 6.404, art. 178). */
export const BalanceCategory = {
    CURRENT_ASSET: 'CURRENT_ASSET',
    NON_CURRENT_ASSET: 'NON_CURRENT_ASSET',
    CURRENT_LIABILITY: 'CURRENT_LIABILITY',
    NON_CURRENT_LIABILITY: 'NON_CURRENT_LIABILITY',
    EQUITY: 'EQUITY',
} as const;

export type BalanceCategory = (typeof BalanceCategory)[keyof typeof BalanceCategory];

export const balanceCategoryRules = categoryRules<BalanceCategory>({
    allowed: {
        ASSET: [BalanceCategory.CURRENT_ASSET, BalanceCategory.NON_CURRENT_ASSET],
        LIABILITY: [BalanceCategory.CURRENT_LIABILITY, BalanceCategory.NON_CURRENT_LIABILITY],
        EQUITY: [BalanceCategory.EQUITY],
        REVENUE: [],
        EXPENSE: [],
    },
    defaults: {
        ASSET: BalanceCategory.CURRENT_ASSET,
        LIABILITY: BalanceCategory.CURRENT_LIABILITY,
        EQUITY: BalanceCategory.EQUITY,
    },
    errorCode: ErrorCode.BALANCE_CATEGORY_INVALID,
    label: 'categoria de balanço',
});
