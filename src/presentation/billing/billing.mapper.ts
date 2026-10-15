import type { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import type { BillingAccountWithRefs } from '@/domain/repositories/billing-account.repository.interface.js';

export function toPlanResponse(plan: BillingPlanEntity) {
    return {
        id: plan.id,
        name: plan.name,
        description: plan.description,
        createdAt: plan.createdAt.toISOString(),
    };
}

/** Conta com o nome do pai e do plano, lidos na mesma consulta. */
export function toAccountResponse({
    account,
    parentName,
    billingPlanName,
}: BillingAccountWithRefs) {
    return {
        id: account.id,
        name: account.name,
        code: account.code,
        level: account.level,
        accountType: account.accountType,
        nature: account.nature,
        isActive: account.isActive,
        billingPlanId: account.billingPlanId,
        billingPlanName,
        parentId: account.parentId,
        parentName,
        createdAt: account.createdAt.toISOString(),
    };
}
