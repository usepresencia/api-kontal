import type { TitleSeries } from '@prisma/client';
import { SeriesEntity } from '@/domain/entities/series.entity.js';

export function toSeriesEntity(row: TitleSeries): SeriesEntity {
    return SeriesEntity.fromPersistence({
        id: row.id,
        companyId: row.companyId,
        kind: row.kind,
        frequency: row.frequency,
        totalCount: row.totalCount,
        baseDescription: row.baseDescription,
        firstIssueDate: row.firstIssueDate,
        firstExpirationDate: row.firstExpirationDate,
        createdAt: row.createdAt,
    });
}
