import type { Prisma } from '@prisma/client';
import type { EntryEntity } from '@/domain/entities/entry.entity.js';
import type { IEntryTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    toEntryCreateData,
    toEntryEntity,
    toEntryUpdateData,
} from '@/infrastructure/persistence/entry.prisma.mapper.js';

export class EntryTxRepository implements IEntryTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async find(companyId: string, id: string): Promise<EntryEntity | null> {
        const row = await this.client.entry.findFirst({ where: { id, title: { companyId } } });
        return row ? toEntryEntity(row) : null;
    }

    async insert(entry: EntryEntity): Promise<void> {
        await this.client.entry.create({ data: toEntryCreateData(entry) });
    }

    async save(entry: EntryEntity): Promise<void> {
        await this.client.entry.update({ where: { id: entry.id }, data: toEntryUpdateData(entry) });
    }

    async delete(id: string): Promise<void> {
        await this.client.entry.delete({ where: { id } });
    }

    async hasWriteOff(titleId: string): Promise<boolean> {
        return (await this.client.entry.count({ where: { titleId, kind: 'WRITE_OFF' } })) > 0;
    }
}
