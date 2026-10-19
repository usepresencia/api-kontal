import type { PartyView } from '@/domain/repositories/party.repository.interface.js';

/** Resposta da API para uma contraparte, com o nome do preset padrão. */
export function toPartyResponse({ party, defaultPresetName }: PartyView) {
    return {
        id: party.id,
        kind: party.kind,
        name: party.name,
        socialReason: party.socialReason,
        document: party.document,
        email: party.email,
        phone: party.phone,
        address: party.address,
        isActive: party.isActive,
        defaultPresetId: party.defaultPresetId,
        defaultPresetName,
        createdAt: party.createdAt.toISOString(),
    };
}
