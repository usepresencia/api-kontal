import { Injectable } from '@nestjs/common';
import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import { type Page, type PageRequest, pageOffset } from '@/domain/pagination.js';
import type {
    ISeriesReadRepository,
    SeriesFilter,
    SeriesView,
} from '@/domain/repositories/series-read.repository.interface.js';
import { PrismaService } from '@/infrastructure/persistence/prisma.service.js';
import { toSeriesEntity } from '@/infrastructure/persistence/series.prisma.mapper.js';
import { toTitleEntity } from '@/infrastructure/persistence/title.prisma.mapper.js';

@Injectable()
export class SeriesReadPrismaRepository implements ISeriesReadRepository {
    constructor(private readonly prisma: PrismaService) {}

    async find(companyId: string, id: string): Promise<SeriesView | null> {
        const row = await this.prisma.titleSeries.findFirst({
            where: { id, companyId },
            include: { titles: { orderBy: { seriesIndex: 'asc' } } },
            relationLoadStrategy: 'join',
        });
        return row ? { series: toSeriesEntity(row), titles: row.titles.map(toTitleEntity) } : null;
    }

    async list(
        companyId: string,
        filter: SeriesFilter,
        page: PageRequest,
    ): Promise<Page<SeriesEntity>> {
        const where = { companyId, ...(filter.kind ? { kind: filter.kind } : {}) };
        const [rows, total] = await this.prisma.$transaction([
            this.prisma.titleSeries.findMany({
                where,
                orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
                skip: pageOffset(page),
                take: page.pageSize,
            }),
            this.prisma.titleSeries.count({ where }),
        ]);
        return { items: rows.map(toSeriesEntity), page: page.page, pageSize: page.pageSize, total };
    }
}
