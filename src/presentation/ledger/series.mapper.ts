import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';
import { toTitleResponse } from '@/presentation/ledger/title.mapper.js';

export function toSeriesResponse(series: SeriesEntity) {
    return {
        id: series.id,
        kind: series.kind,
        frequency: series.frequency,
        totalCount: series.totalCount,
        baseDescription: series.baseDescription,
        firstIssueDate: toIsoDate(series.firstIssueDate),
        firstExpirationDate: toIsoDate(series.firstExpirationDate),
        createdAt: series.createdAt.toISOString(),
    };
}

/** Série com os títulos que ela gerou (sem o nome do preset nem da contraparte). */
export function toSeriesDetailResponse(series: SeriesEntity, titles: readonly TitleEntity[]) {
    return {
        ...toSeriesResponse(series),
        titles: titles.map(title => toTitleResponse(title, null, null)),
    };
}
