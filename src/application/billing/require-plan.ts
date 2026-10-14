import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';

/**
 * Carrega o plano da empresa.
 * @throws DomainError BILLING_PLAN_NOT_FOUND (inclusive para plano de outra empresa)
 */
export async function requirePlan(
    plans: IBillingPlanRepository,
    companyId: string,
    id: string,
): Promise<BillingPlanEntity> {
    const plan = await plans.findById(companyId, id);
    if (!plan) {
        throw new DomainError(ErrorCode.BILLING_PLAN_NOT_FOUND, 'Plano de contas não encontrado');
    }
    return plan;
}
