import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { requirePlan } from '@/application/billing/require-plan.js';
import { requirePreset } from '@/application/ledger/require-preset.js';
import { validatePresetAccounts } from '@/application/ledger/presets/validate-preset-accounts.js';
import { PresetEntity } from '@/domain/entities/preset.entity.js';
import type { PresetAccountIds } from '@/domain/ledger/preset-roles.js';
import type { IBillingAccountRepository } from '@/domain/repositories/billing-account.repository.interface.js';
import type { IBillingPlanRepository } from '@/domain/repositories/billing-plan.repository.interface.js';
import type {
    IPresetRepository,
    PresetView,
} from '@/domain/repositories/preset.repository.interface.js';
import {
    BILLING_ACCOUNT_REPOSITORY,
    BILLING_PLAN_REPOSITORY,
    PRESET_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

export interface PresetInput {
    billingPlanId: string;
    name: string;
    description?: string;
    isActive?: boolean;
    accounts: Partial<PresetAccountIds>;
}

@Injectable()
export class CreatePresetService {
    constructor(
        @Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository,
        @Inject(BILLING_PLAN_REPOSITORY) private readonly plans: IBillingPlanRepository,
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    /**
     * Cria o preset validando o plano e as contas da empresa.
     * @throws DomainError BILLING_PLAN_NOT_FOUND, PRESET_ACCOUNT_INVALID, PRESET_PLAN_MISMATCH
     */
    async execute(companyId: string, input: PresetInput): Promise<PresetView> {
        await requirePlan(this.plans, companyId, input.billingPlanId);
        const preset = PresetEntity.create({ id: randomUUID(), ...input });
        await validatePresetAccounts(
            this.accounts,
            companyId,
            preset.billingPlanId,
            preset.accounts,
        );
        await this.presets.create(preset);
        return requirePreset(this.presets, companyId, preset.id);
    }
}
