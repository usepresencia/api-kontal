import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import { BILLING_PLAN_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class CreateBillingPlanService {
    constructor(@Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository) {}

    async execute(
        companyId: string,
        input: { name: string; description?: string },
    ): Promise<BillingPlanEntity> {
        const plan = BillingPlanEntity.create({ id: randomUUID(), companyId, ...input });
        await this.plans.create(plan);
        return plan;
    }
}
