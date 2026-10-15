import { requirePlan } from '@/application/billing/require-plan.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';

/**
 * Plano do relatório: o informado (se for da empresa) ou o único plano da empresa.
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
    const page = await plans.list(companyId, { page: 1, pageSize: 2 });
    if (page.total !== 1) {
        throw new DomainError(
            ErrorCode.BILLING_PLAN_REQUIRED,
            'Informe o plano de contas (billingPlanId): a empresa não tem exatamente um plano',
        );
    }
    return page.items[0].id;
}
