import type { Prisma } from '@prisma/client';
import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
import type { ISeriesTxRepository } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { toSeriesEntity } from '@/infrastructure/persistence/series.prisma.mapper.js';
import { toTitleEntity } from '@/infrastructure/persistence/title.prisma.mapper.js';

export class SeriesTxRepository implements ISeriesTxRepository {
    constructor(private readonly client: Prisma.TransactionClient) {}

    async insert(series: SeriesEntity): Promise<void> {
        await this.client.titleSeries.create({
            data: {
                id: series.id,
                companyId: series.companyId,
                kind: series.kind,
                frequency: series.frequency,
                totalCount: series.totalCount,
                baseDescription: series.baseDescription,
                firstIssueDate: series.firstIssueDate,
                firstExpirationDate: series.firstExpirationDate,
                createdAt: series.createdAt,
            },
        });
    }

    async lock(companyId: string, id: string): Promise<SeriesEntity | null> {
        const rows = await this.client.$queryRaw<{ id: string }[]>`
            SELECT "id" FROM "TitleSeries" WHERE "id" = ${id} AND "companyId" = ${companyId} FOR UPDATE`;
        if (rows.length === 0) return null;
        return toSeriesEntity(await this.client.titleSeries.findUniqueOrThrow({ where: { id } }));
    }

    async save(series: SeriesEntity): Promise<void> {
        await this.client.titleSeries.update({
            where: { id: series.id },
            data: { totalCount: series.totalCount },
        });
    }

    async delete(id: string): Promise<void> {
        await this.client.titleSeries.delete({ where: { id } });
    }

    async titles(seriesId: string): Promise<TitleEntity[]> {
        const rows = await this.client.title.findMany({
            where: { seriesId },
            orderBy: { seriesIndex: 'asc' },
        });
        return rows.map(toTitleEntity);
    }

    async lastTitle(seriesId: string): Promise<TitleEntity | null> {
        const row = await this.client.title.findFirst({
            where: { seriesId },
            orderBy: { seriesIndex: 'desc' },
        });
        return row ? toTitleEntity(row) : null;
    }
}
