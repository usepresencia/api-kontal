import { requirePlan } from '@/application/billing/require-plan.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';

/**
 * Plano do relatório: o informado (se for da empresa) ou o plano padrão da empresa.
 * @throws DomainError BILLING_PLAN_NOT_FOUND, BILLING_PLAN_REQUIRED
 */
export async function resolveReportPlan(
    plans: IBillingPlanRepository,
    companyId: string,
    billingPlanId: string | undefined,
): Promise<string> {
    if (billingPlanId) {
        await requirePlan(plans, companyId, billingPlanId);
        return billingPlanId;
    }
    const plan = await plans.findDefault(companyId);
    if (!plan) {
        throw new DomainError(
            ErrorCode.BILLING_PLAN_REQUIRED,
            'A empresa não tem plano de contas padrão: crie um plano ou informe o billingPlanId',
        );
    }
    return plan.id;
}
