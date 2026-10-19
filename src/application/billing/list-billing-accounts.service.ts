import { Inject, Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import { BILLING_ACCOUNT_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListBillingAccountsService {
    constructor(
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    execute(
        companyId: string,
        filter: { planId?: string },
        page: PageRequest,
    ): Promise<Page<BillingAccountWithRefs>> {
        return this.accounts.list(companyId, filter, page);
    }
}
