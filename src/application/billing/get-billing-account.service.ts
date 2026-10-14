import { Inject, Injectable } from '@nestjs/common';
import { requireAccount } from '@/application/billing/require-account.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import { BILLING_ACCOUNT_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetBillingAccountService {
    constructor(
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    execute(companyId: string, id: string): Promise<BillingAccountWithRefs> {
        return requireAccount(this.accounts, companyId, id);
    }
}
