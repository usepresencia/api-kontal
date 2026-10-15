import type { Prisma } from '@prisma/client';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
import type { ITitleTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    toTitleCreateData,
    toTitleEntity,
    toTitleUpdateData,
} from '@/infrastructure/persistence/title.prisma.mapper.js';

export class TitleTxRepository implements ITitleTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async lock(companyId: string, id: string): Promise<TitleEntity | null> {
        const rows = await this.client.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "Title" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
        if (rows.length === 0) return null;
        return toTitleEntity(await this.client.title.findUniqueOrThrow({ where: { id } }));
    }

    async insertAll(titles: readonly TitleEntity[]): Promise<void> {
        if (titles.length === 0) return;
        await this.client.title.createMany({ data: titles.map(toTitleCreateData) });
    }

    async save(title: TitleEntity): Promise<void> {
        await this.client.title.update({ where: { id: title.id }, data: toTitleUpdateData(title) });
    }

    async deleteAll(ids: readonly string[]): Promise<void> {
        if (ids.length === 0) return;
        await this.client.title.deleteMany({ where: { id: { in: [...ids] } } });
    }

    countEntries(titleId: string): Promise<number> {
        return this.client.entry.count({ where: { titleId } });
    }

    async idsWithEntries(ids: readonly string[]): Promise<Set<string>> {
        if (ids.length === 0) return new Set();
        const rows = await this.client.entry.findMany({
            where: { titleId: { in: [...ids] } },
            select: { titleId: true },
            distinct: ['titleId'],
        });
        return new Set(rows.map(row => row.titleId));
    }
}
