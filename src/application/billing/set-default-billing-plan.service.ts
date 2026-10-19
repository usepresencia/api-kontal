import { Inject, Injectable } from '@nestjs/common';
import { requirePlan } from '@/application/billing/require-plan.js';
import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import { BILLING_PLAN_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class SetDefaultBillingPlanService {
    constructor(@Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository) {}

    /** Torna o plano o padrão da empresa; se já é o padrão, não muda nada. */
    async execute(companyId: string, id: string): Promise<BillingPlanEntity> {
        const plan = await requirePlan(this.plans, companyId, id);
        if (plan.isDefault) return plan;
        await this.plans.setDefault(companyId, id);
        return requirePlan(this.plans, companyId, id);
    }
}
