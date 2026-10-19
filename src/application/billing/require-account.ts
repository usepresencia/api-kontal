import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';

/**
 * Carrega a conta da empresa.
 * @throws DomainError BILLING_ACCOUNT_NOT_FOUND (inclusive para conta de outra empresa)
 */
export async function requireAccount(
    accounts: IBillingAccountRepository,
    companyId: string,
    id: string,
): Promise<BillingAccountWithRefs> {
    const view = await accounts.findById(companyId, id);
    if (!view) {
        throw new DomainError(ErrorCode.BILLING_ACCOUNT_NOT_FOUND, 'Conta não encontrada');
    }
    return view;
}
