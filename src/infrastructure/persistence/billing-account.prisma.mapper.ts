import type { Prisma } from '@prisma/client';
import { BillingAccountEntity } from '@/domain/entities/billing-account.entity.js';
import type { BillingAccountWithRefs } from '@/domain/repositories/billing-account.repository.interface.js';

/** Relações lidas junto com a conta (nome do pai e do plano). */
export const ACCOUNT_REFS = {
    parent: { select: { name: true } },
    billingPlan: { select: { name: true } },
} as const;

export type AccountWithRefs = Prisma.BillingAccountGetPayload<{ include: typeof ACCOUNT_REFS }>;

export function toAccountView(row: AccountWithRefs): BillingAccountWithRefs {
    return {
        account: BillingAccountEntity.fromPersistence(row),
        parentName: row.parent?.name ?? null,
        billingPlanName: row.billingPlan.name,
    };
}
