export const AccountType = {
    ANALYTIC: 'ANALYTIC',
    SYNTHETIC: 'SYNTHETIC',
} as const;

export type AccountType = (typeof AccountType)[keyof typeof AccountType];
