import type { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountType } from '@/domain/billing/account-type.js';

/** Dados de uma conta usados para validar compatibilidade com um papel contábil. */
export interface AccountRef {
    id: string;
    billingPlanId: string;
    accountType: AccountType;
    nature: AccountNature;
    isActive: boolean;
}
