import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

export interface IBillingPlanRepository {
    /** Grava o plano; o primeiro plano da empresa já nasce como o padrão. Devolve o plano gravado. */
    create(plan: BillingPlanEntity): Promise<BillingPlanEntity>;
    /** Plano padrão da empresa, ou null se ela não tem plano. */
    findDefault(companyId: string): Promise<BillingPlanEntity | null>;
    /** Torna o plano o padrão da empresa e desmarca o anterior, na mesma transação. */
    setDefault(companyId: string, id: string): Promise<void>;
    /** Devolve o plano só se ele pertence à empresa. */
    findById(companyId: string, id: string): Promise<BillingPlanEntity | null>;
    list(companyId: string, page: PageRequest): Promise<Page<BillingPlanEntity>>;
    update(plan: BillingPlanEntity): Promise<void>;
    hasAccounts(planId: string): Promise<boolean>;
    delete(companyId: string, id: string): Promise<void>;
}
