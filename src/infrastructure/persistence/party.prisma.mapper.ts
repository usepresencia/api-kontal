import type { Prisma } from '@prisma/client';
import { type PartyAddress, PartyEntity } from '@/domain/entities/party.entity.js';
import type { PartyView } from '@/domain/repositories/party.repository.interface.js';

/** Relações lidas junto com a contraparte (nome do preset padrão). */
export const PARTY_REFS = { defaultPreset: { select: { name: true } } } as const;

export type PartyWithRefs = Prisma.PartyGetPayload<{ include: typeof PARTY_REFS }>;

function toAddress(row: PartyWithRefs): PartyAddress | null {
    const { zipCode, street, number, neighborhood, city, state } = row;
    if (!zipCode || !street || !number || !neighborhood || !city || !state) return null;
    return { zipCode, street, number, complement: row.complement, neighborhood, city, state };
}

/** Colunas de endereço da contraparte; nulas quando não há endereço. */
export function toAddressColumns(address: PartyAddress | null) {
    return {
        zipCode: address?.zipCode ?? null,
        street: address?.street ?? null,
        number: address?.number ?? null,
        complement: address?.complement ?? null,
        neighborhood: address?.neighborhood ?? null,
        city: address?.city ?? null,
        state: address?.state ?? null,
    };
}

export function toPartyView(row: PartyWithRefs): PartyView {
    return {
        party: PartyEntity.fromPersistence({
            id: row.id,
            companyId: row.companyId,
            kind: row.kind,
            name: row.name,
            socialReason: row.socialReason,
            document: row.document,
            email: row.email,
            phone: row.phone,
            address: toAddress(row),
            isActive: row.isActive,
            defaultPresetId: row.defaultPresetId,
            createdAt: row.createdAt,
        }),
        defaultPresetName: row.defaultPreset?.name ?? null,
    };
}
