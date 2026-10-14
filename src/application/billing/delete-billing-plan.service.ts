import { Inject, Injectable } from '@nestjs/common';
import { requirePlan } from '@/application/billing/require-plan.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import { BILLING_PLAN_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class DeleteBillingPlanService {
    constructor(@Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository) {}

    /**
     * Exclui o plano da empresa.
     * @throws DomainError PLAN_HAS_ACCOUNTS se o plano ainda tem contas
     */
    async execute(companyId: string, id: string): Promise<void> {
        await requirePlan(this.plans, companyId, id);
        if (await this.plans.hasAccounts(id)) {
            throw new DomainError(
                ErrorCode.PLAN_HAS_ACCOUNTS,
                'Exclusão bloqueada: o plano possui contas',
            );
        }
        await this.plans.delete(companyId, id);
    }
}
