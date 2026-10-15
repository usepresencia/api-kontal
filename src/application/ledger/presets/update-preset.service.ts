import { Inject, Injectable } from '@nestjs/common';
import { requirePreset } from '@/application/ledger/require-preset.js';
import { validatePresetAccounts } from '@/application/ledger/presets/validate-preset-accounts.js';
import type { PresetInput } from '@/application/ledger/presets/create-preset.service.js';
import type { IBillingAccountRepository } from '@/domain/repositories/billing-account.repository.interface.js';
import type {
    IPresetRepository,
    PresetView,
} from '@/domain/repositories/preset.repository.interface.js';
import {
    BILLING_ACCOUNT_REPOSITORY,
    PRESET_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class UpdatePresetService {
    constructor(
        @Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository,
        @Inject(BILLING_ACCOUNT_REPOSITORY) private readonly accounts: IBillingAccountRepository,
    ) {}

    /** Substitui nome, descrição, status e contas, dentro do plano do preset (imutável). */
    async execute(
        companyId: string,
        id: string,
        input: Omit<PresetInput, 'billingPlanId'> & { billingPlanId?: string },
    ): Promise<PresetView> {
        const { preset } = await requirePreset(this.presets, companyId, id);
        const updated = preset.withChanges(input);
        await validatePresetAccounts(
            this.accounts,
            companyId,
            preset.billingPlanId,
            updated.accounts,
        );
        await this.presets.update(companyId, updated);
        return requirePreset(this.presets, companyId, id);
    }
}
