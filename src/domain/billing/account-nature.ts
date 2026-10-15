export const AccountNature = {
    ASSET: 'ASSET',
    LIABILITY: 'LIABILITY',
    EQUITY: 'EQUITY',
    REVENUE: 'REVENUE',
    EXPENSE: 'EXPENSE',
} as const;

export type AccountNature = (typeof AccountNature)[keyof typeof AccountNature];
