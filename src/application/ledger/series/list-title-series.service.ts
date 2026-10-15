import { Inject, Injectable } from '@nestjs/common';
import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    ISeriesReadRepository,
    SeriesFilter,
} from '@/domain/repositories/series-read.repository.interface.js';
import { SERIES_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListTitleSeriesService {
    constructor(@Inject(SERIES_READ_REPOSITORY) private readonly series: ISeriesReadRepository) {}

    execute(
        companyId: string,
        filter: SeriesFilter,
        page: PageRequest,
    ): Promise<Page<SeriesEntity>> {
        return this.series.list(companyId, filter, page);
    }
}
