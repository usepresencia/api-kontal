import { Inject, Injectable } from '@nestjs/common';
import { requirePreset } from '@/application/ledger/require-preset.js';
import { requireParty } from '@/application/parties/require-party.js';
import type { PartyEntity, PartyInput } from '@/domain/entities/party.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    IPartyRepository,
    PartyView,
} from '@/domain/repositories/party.repository.interface.js';
import type { IPresetRepository } from '@/domain/repositories/preset.repository.interface.js';
import {
    PARTY_REPOSITORY,
    PRESET_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class UpdatePartyService {
    constructor(
        @Inject(PARTY_REPOSITORY) private readonly parties: IPartyRepository,
        @Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository,
    ) {}

    /**
     * Substitui os dados da contraparte, mantendo o próprio documento sem conflito.
     * @throws DomainError PARTY_NOT_FOUND, VALIDATION_ERROR, PARTY_DOCUMENT_TAKEN, PRESET_NOT_FOUND
     */
    async execute(companyId: string, id: string, input: PartyInput): Promise<PartyView> {
        const { party } = await requireParty(this.parties, companyId, id);
        const updated = party.withChanges(input);
        await this.assertKindKeepsTitles(id, party.kind, updated);
        if (await this.parties.documentTaken(companyId, updated.document, id)) {
            throw new DomainError(
                ErrorCode.PARTY_DOCUMENT_TAKEN,
                'Já existe uma contraparte com este documento',
            );
        }
        if (updated.defaultPresetId) {
            await requirePreset(this.presets, companyId, updated.defaultPresetId);
        }
        await this.parties.update(companyId, updated);
        return requireParty(this.parties, companyId, id);
    }

    /** Recusa mudar o tipo de modo que títulos existentes deixem de ser compatíveis com ele. */
    private async assertKindKeepsTitles(
        id: string,
        previous: PartyEntity['kind'],
        updated: PartyEntity,
    ): Promise<void> {
        if (updated.kind === previous) return;
        for (const type of ['EXPENSE', 'INCOME'] as const) {
            if (!updated.canTransact(type) && (await this.parties.hasTitlesOfType(id, type))) {
                throw new DomainError(
                    ErrorCode.PARTY_KIND_MISMATCH,
                    'O tipo não pode mudar: há títulos que ele deixaria de aceitar',
                );
            }
        }
    }
}
