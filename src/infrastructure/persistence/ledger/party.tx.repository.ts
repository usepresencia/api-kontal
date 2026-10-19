import type { Prisma } from '@prisma/client';
import type { PartyEntity } from '@/domain/entities/party.entity.js';
import type { IPartyTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { PARTY_REFS, toPartyView } from '@/infrastructure/persistence/party.prisma.mapper.js';

export class PartyTxRepository implements IPartyTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async find(companyId: string, id: string): Promise<PartyEntity | null> {
        const row = await this.client.party.findFirst({
            where: { id, companyId },
            include: PARTY_REFS,
            relationLoadStrategy: 'join',
        });
        return row ? toPartyView(row).party : null;
    }
}
