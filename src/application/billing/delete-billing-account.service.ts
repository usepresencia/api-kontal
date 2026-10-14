import { Inject, Injectable } from '@nestjs/common';
import { requireAccount } from '@/application/billing/require-account.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IBillingAccountRepository } from '@/domain/repositories/billing-account.repository.interface.js';
import { BILLING_ACCOUNT_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class DeleteBillingAccountService {
    constructor(
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    /**
     * Exclui a conta da empresa.
     * @throws DomainError ACCOUNT_HAS_CHILDREN se a conta tem filhas
     */
    async execute(companyId: string, id: string): Promise<void> {
        await requireAccount(this.accounts, companyId, id);
        if (await this.accounts.hasChildren(id)) {
            throw new DomainError(
                ErrorCode.ACCOUNT_HAS_CHILDREN,
                'Exclusão bloqueada: esta conta possui contas filhas',
            );
        }
        await this.accounts.delete(companyId, id);
    }
}
