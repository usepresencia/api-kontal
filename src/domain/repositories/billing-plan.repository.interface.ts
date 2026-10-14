import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

export interface IBillingPlanRepository {
    create(plan: BillingPlanEntity): Promise<void>;
    /** Devolve o plano só se ele pertence à empresa. */
    findById(companyId: string, id: string): Promise<BillingPlanEntity | null>;
    list(companyId: string, page: PageRequest): Promise<Page<BillingPlanEntity>>;
    update(plan: BillingPlanEntity): Promise<void>;
    hasAccounts(planId: string): Promise<boolean>;
    delete(companyId: string, id: string): Promise<void>;
}
