import type { PartyEntity } from '@/domain/entities/party.entity.js';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { ILedgerTx } from '@/domain/repositories/ledger.unit-of-work.interface.js';

/**
 * Carrega a contraparte do tenant, que precisa estar ativa e aceitar o tipo de título.
 * @throws DomainError PARTY_NOT_FOUND, PARTY_INACTIVE, PARTY_KIND_MISMATCH
 */
export async function requireUsableParty(
    tx: ILedgerTx,
    companyId: string,
    partyId: string,
    type: TitleType,
): Promise<PartyEntity> {
    const party = await tx.parties.find(companyId, partyId);
    if (!party) throw new DomainError(ErrorCode.PARTY_NOT_FOUND, 'Contraparte não encontrada');
    if (!party.isActive) {
        throw new DomainError(ErrorCode.PARTY_INACTIVE, 'A contraparte está inativa');
    }
    if (!party.canTransact(type)) {
        throw new DomainError(
            ErrorCode.PARTY_KIND_MISMATCH,
            'O tipo da contraparte não permite este tipo de título',
        );
    }
    return party;
}

/**
 * Carrega a contraparte do tenant e o preset do título (o informado ou o padrão dela).
 * @throws DomainError PARTY_NOT_FOUND, PARTY_INACTIVE, PARTY_KIND_MISMATCH, PARTY_PRESET_REQUIRED,
 *   PRESET_NOT_FOUND, PRESET_INACTIVE
 */
export async function resolvePartyPreset(
    tx: ILedgerTx,
    companyId: string,
    input: { partyId: string; presetId?: string; type: TitleType },
): Promise<{ party: PartyEntity; preset: PresetEntity }> {
    const party = await requireUsableParty(tx, companyId, input.partyId, input.type);
    const presetId = input.presetId ?? party.defaultPresetId;
    if (!presetId) {
        throw new DomainError(
            ErrorCode.PARTY_PRESET_REQUIRED,
            'Informe o preset ou defina um preset padrão para a contraparte',
        );
    }
    const preset = await tx.presets.find(companyId, presetId);
    if (!preset) throw new DomainError(ErrorCode.PRESET_NOT_FOUND, 'Preset não encontrado');
    if (!preset.isActive) {
        throw new DomainError(ErrorCode.PRESET_INACTIVE, 'O preset está inativo');
    }
    return { party, preset };
}
