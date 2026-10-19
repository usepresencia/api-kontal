import { ErrorCode } from '@/domain/errors/error-codes.js';
import { categoryRules } from '@/domain/billing/category-rules.js';

/** Linhas do DRE por função (CPC 26 / Lei 6.404, art. 187). */
export const DreCategory = {
    GROSS_REVENUE: 'GROSS_REVENUE',
    FINANCIAL_REVENUE: 'FINANCIAL_REVENUE',
    OTHER_REVENUE: 'OTHER_REVENUE',
    REVENUE_DEDUCTION: 'REVENUE_DEDUCTION',
    COST_OF_SALES: 'COST_OF_SALES',
    OPERATING_EXPENSE: 'OPERATING_EXPENSE',
    FINANCIAL_EXPENSE: 'FINANCIAL_EXPENSE',
    OTHER_EXPENSE: 'OTHER_EXPENSE',
    INCOME_TAX: 'INCOME_TAX',
} as const;

export type DreCategory = (typeof DreCategory)[keyof typeof DreCategory];

export const dreCategoryRules = categoryRules<DreCategory>({
    allowed: {
        REVENUE: [
            DreCategory.GROSS_REVENUE,
            DreCategory.FINANCIAL_REVENUE,
            DreCategory.OTHER_REVENUE,
        ],
        EXPENSE: [
            DreCategory.REVENUE_DEDUCTION,
            DreCategory.COST_OF_SALES,
            DreCategory.OPERATING_EXPENSE,
            DreCategory.FINANCIAL_EXPENSE,
            DreCategory.OTHER_EXPENSE,
            DreCategory.INCOME_TAX,
        ],
        ASSET: [],
        LIABILITY: [],
        EQUITY: [],
    },
    defaults: { REVENUE: DreCategory.GROSS_REVENUE, EXPENSE: DreCategory.OPERATING_EXPENSE },
    errorCode: ErrorCode.DRE_CATEGORY_INVALID,
    label: 'categoria de DRE',
});
