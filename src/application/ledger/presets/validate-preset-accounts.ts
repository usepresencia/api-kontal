import { assertPresetAccounts } from '@/domain/ledger/account-compatibility.policy.js';
import { PRESET_ROLES, type PresetAccountIds } from '@/domain/ledger/preset-roles.js';
import type { IBillingAccountRepository } from '@/domain/repositories/billing-account.repository.interface.js';

/**
 * Confere, com uma consulta, que as contas do preset são da empresa e compatíveis com os papéis.
 * @throws DomainError PRESET_ACCOUNT_INVALID, PRESET_PLAN_MISMATCH
 */
export async function validatePresetAccounts(
    accounts: IBillingAccountRepository,
    companyId: string,
    planId: string,
    ids: PresetAccountIds,
): Promise<void> {
    const wanted = PRESET_ROLES.map(role => ids[role]).filter((id): id is string => id !== null);
    assertPresetAccounts(planId, ids, await accounts.findRefsByIds(companyId, wanted));
}
