import { Inject, Injectable } from '@nestjs/common';
import { requirePlan } from '@/application/billing/require-plan.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import {
    BILLING_ACCOUNT_REPOSITORY,
    BILLING_PLAN_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListPlanAccountsService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    /** Todas as contas do plano em ordem natural de código. */
    async execute(companyId: string, planId: string): Promise<BillingAccountWithRefs[]> {
        await requirePlan(this.plans, companyId, planId);
        return this.accounts.listByPlan(companyId, planId);
    }
}
