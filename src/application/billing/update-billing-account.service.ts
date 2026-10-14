import { Inject, Injectable } from '@nestjs/common';
import { requireAccount } from '@/application/billing/require-account.js';
import { assertCanChangeType } from '@/domain/billing/account-hierarchy.policy.js';
import { AccountType } from '@/domain/billing/account-type.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import { BILLING_ACCOUNT_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class UpdateBillingAccountService {
    constructor(
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    /** Altera nome, status e tipo; só valida filhas quando a conta vira analítica. */
    async execute(
        companyId: string,
        id: string,
        changes: { name?: string; isActive?: boolean; accountType?: AccountType },
    ): Promise<BillingAccountWithRefs> {
        const current = await requireAccount(this.accounts, companyId, id);
        const { account } = current;
        if (changes.accountType !== undefined && changes.accountType !== account.accountType) {
            const hasChildren =
                changes.accountType === AccountType.ANALYTIC
                    ? await this.accounts.hasChildren(id)
                    : false;
            assertCanChangeType(changes.accountType, account.parentId !== null, hasChildren);
        }
        const updated = account.withChanges(changes);
        await this.accounts.update(companyId, updated);
        return { ...current, account: updated };
    }
}
