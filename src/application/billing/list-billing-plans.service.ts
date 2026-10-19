import { Inject, Injectable } from '@nestjs/common';
import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import { BILLING_PLAN_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListBillingPlansService {
    constructor(@Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository) {}

    execute(companyId: string, page: PageRequest): Promise<Page<BillingPlanEntity>> {
        return this.plans.list(companyId, page);
    }
}
