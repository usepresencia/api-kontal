export const TitleType = {
    INCOME: 'INCOME',
    EXPENSE: 'EXPENSE',
} as const;

export type TitleType = (typeof TitleType)[keyof typeof TitleType];
