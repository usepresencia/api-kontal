import { Inject, Injectable } from '@nestjs/common';
import { requirePlan } from '@/application/billing/require-plan.js';
import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import { BILLING_PLAN_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetBillingPlanService {
    constructor(@Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository) {}

    execute(companyId: string, id: string): Promise<BillingPlanEntity> {
        return requirePlan(this.plans, companyId, id);
    }
}
