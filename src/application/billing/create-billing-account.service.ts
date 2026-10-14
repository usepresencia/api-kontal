import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { requirePlan } from '@/application/billing/require-plan.js';
import { nextAccountCode } from '@/domain/billing/account-code.js';
import { assertValidPlacement } from '@/domain/billing/account-hierarchy.policy.js';
import type { AccountType } from '@/domain/billing/account-type.js';
import { BillingAccountEntity } from '@/domain/entities/billing-account.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    BillingAccountWithRefs,
    IBillingAccountRepository,
} from '@/domain/repositories/billing-account.repository.interface.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import {
    BILLING_ACCOUNT_REPOSITORY,
    BILLING_PLAN_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface CreateBillingAccountInput {
    billingPlanId: string;
    parentId?: string | null;
    name: string;
    accountType: AccountType;
    isActive?: boolean;
}

@Injectable()
export class CreateBillingAccountService {
    constructor(
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    /**
     * Cria a conta sob o pai informado (ou na raiz), validando a posição na árvore.
     * @throws DomainError se o plano ou o pai não existem na empresa ou a posição é inválida
     */
    async execute(
        companyId: string,
        input: CreateBillingAccountInput,
    ): Promise<BillingAccountWithRefs> {
        await requirePlan(this.plans, companyId, input.billingPlanId);
        const parent = input.parentId
            ? await this.requireParent(companyId, input.billingPlanId, input.parentId)
            : null;
        const level = assertValidPlacement(input.accountType, parent);
        const draft = BillingAccountEntity.draft({
            id: randomUUID(),
            billingPlanId: input.billingPlanId,
            parentId: input.parentId ?? null,
            name: input.name,
            accountType: input.accountType,
            isActive: input.isActive,
            level,
        });
        return this.accounts.insertWithNextCode(draft, (parentCode, siblingCodes) =>
            nextAccountCode(parentCode, level, siblingCodes),
        );
    }

    private async requireParent(companyId: string, planId: string, parentId: string) {
        const parent = await this.accounts.findParent(companyId, planId, parentId);
        if (!parent) {
            throw new DomainError(
                ErrorCode.ACCOUNT_PARENT_INVALID,
                'A conta pai não existe neste plano',
            );
        }
        return parent;
    }
}
