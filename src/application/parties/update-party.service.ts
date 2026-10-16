import { Inject, Injectable } from '@nestjs/common';
import { requirePreset } from '@/application/ledger/require-preset.js';
import { requireParty } from '@/application/parties/require-party.js';
import type { PartyInput } from '@/domain/entities/party.entity.js';
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
}
