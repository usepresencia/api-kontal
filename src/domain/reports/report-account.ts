import type { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountType } from '@/domain/billing/account-type.js';
import type { BalanceCategory } from '@/domain/billing/balance-category.js';
import type { CostBehavior } from '@/domain/billing/cost-behavior.js';
import type { DreCategory } from '@/domain/billing/dre-category.js';

/** Conta do plano com os campos usados pelos relatórios. */
export interface ReportAccount {
    id: string;
    parentId: string | null;
    code: string;
    name: string;
    level: number;
    nature: AccountNature;
    accountType: AccountType;
    dreCategory: DreCategory | null;
    balanceCategory: BalanceCategory | null;
    costBehavior: CostBehavior | null;
}
