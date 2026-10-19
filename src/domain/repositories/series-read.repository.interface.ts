import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import type { TitleEntity } from '@/domain/entities/title.entity.js';
import type { SeriesKind } from '@/domain/series/series-schedule.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

/** Série com os títulos que ela gerou, lidos na mesma consulta. */
export interface SeriesView {
    series: SeriesEntity;
    titles: TitleEntity[];
}

export interface SeriesFilter {
    kind?: SeriesKind;
}

export interface ISeriesReadRepository {
    find(companyId: string, id: string): Promise<SeriesView | null>;
    list(companyId: string, filter: SeriesFilter, page: PageRequest): Promise<Page<SeriesEntity>>;
}
