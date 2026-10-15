import { categoryRules } from '@/domain/billing/category-rules.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/** Comportamento do custo ou despesa em relação ao volume de vendas (DRE gerencial). */
export const CostBehavior = {
    VARIABLE: 'VARIABLE',
    FIXED: 'FIXED',
    DEPRECIATION: 'DEPRECIATION',
} as const;

export type CostBehavior = (typeof CostBehavior)[keyof typeof CostBehavior];

export const costBehaviorRules = categoryRules<CostBehavior>({
    allowed: {
        EXPENSE: Object.values(CostBehavior),
        ASSET: [],
        LIABILITY: [],
        EQUITY: [],
        REVENUE: [],
    },
    defaults: {},
    errorCode: ErrorCode.COST_BEHAVIOR_INVALID,
    label: 'comportamento de custo',
});
