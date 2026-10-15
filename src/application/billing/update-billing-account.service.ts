import { Inject, Injectable } from '@nestjs/common';
import { requireAccount } from '@/application/billing/require-account.js';
import { assertCanChangeType } from '@/domain/billing/account-hierarchy.policy.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
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

    /** Altera nome, status e tipo; valida filhas ao virar analítica e uso ao virar sintética. */
    async execute(
        companyId: string,
        id: string,
        changes: { name?: string; isActive?: boolean; accountType?: AccountType },
    ): Promise<BillingAccountWithRefs> {
        const current = await requireAccount(this.accounts, companyId, id);
        const { account } = current;
        if (changes.accountType !== undefined && changes.accountType !== account.accountType) {
            if (changes.accountType === AccountType.SYNTHETIC) {
                await this.assertNotInUse(id);
            } else {
                assertCanChangeType(
                    changes.accountType,
                    account.parentId !== null,
                    await this.accounts.hasChildren(id),
                );
            }
        }
        const updated = account.withChanges(changes);
        await this.accounts.update(companyId, updated);
        return { ...current, account: updated };
    }

    private async assertNotInUse(id: string): Promise<void> {
        if (await this.accounts.isInUse(id)) {
            throw new DomainError(
                ErrorCode.ACCOUNT_IN_USE,
                'A conta está em uso e não pode virar sintética',
            );
        }
    }
}
