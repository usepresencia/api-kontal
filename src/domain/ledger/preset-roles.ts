import { AccountNature } from '@/domain/billing/account-nature.js';

/** Natureza exigida para a conta de cada papel do preset. */
export const PRESET_ROLE_NATURE = {
    receivable: AccountNature.ASSET,
    payable: AccountNature.LIABILITY,
    revenue: AccountNature.REVENUE,
    expense: AccountNature.EXPENSE,
    interestIncome: AccountNature.REVENUE,
    discountGranted: AccountNature.EXPENSE,
    badDebt: AccountNature.EXPENSE,
    interestExpense: AccountNature.EXPENSE,
    discountObtained: AccountNature.REVENUE,
    debtForgiveness: AccountNature.REVENUE,
    openingBalance: AccountNature.EQUITY,
} as const;

export type PresetRole = keyof typeof PRESET_ROLE_NATURE;

export const PRESET_ROLES = Object.keys(PRESET_ROLE_NATURE) as PresetRole[];

export const REQUIRED_PRESET_ROLES: readonly PresetRole[] = ['receivable', 'payable'];

/** Ids das contas do preset por papel; papéis opcionais sem conta ficam `null`. */
export type PresetAccountIds = Record<PresetRole, string | null>;
