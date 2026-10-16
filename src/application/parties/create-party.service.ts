import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { requirePreset } from '@/application/ledger/require-preset.js';
import { requireParty } from '@/application/parties/require-party.js';
import { PartyEntity, type PartyInput } from '@/domain/entities/party.entity.js';
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
export class CreatePartyService {
    constructor(
        @Inject(PARTY_REPOSITORY) private readonly parties: IPartyRepository,
        @Inject(PRESET_REPOSITORY) private readonly presets: IPresetRepository,
    ) {}

    /**
     * Cria a contraparte do tenant, validando o documento e o preset padrão.
     * @throws DomainError VALIDATION_ERROR, PARTY_DOCUMENT_TAKEN, PRESET_NOT_FOUND
     */
    async execute(companyId: string, input: PartyInput): Promise<PartyView> {
        const party = PartyEntity.create({ id: randomUUID(), companyId, ...input });
        if (await this.parties.documentTaken(companyId, party.document)) {
            throw new DomainError(
                ErrorCode.PARTY_DOCUMENT_TAKEN,
                'Já existe uma contraparte com este documento',
            );
        }
        if (party.defaultPresetId) {
            await requirePreset(this.presets, companyId, party.defaultPresetId);
        }
        await this.parties.create(party);
        return requireParty(this.parties, companyId, party.id);
    }
}
