import { Inject, Injectable } from '@nestjs/common';
import { requireSeriesView } from '@/application/ledger/require-series.js';
import type {
    ISeriesReadRepository,
    SeriesView,
} from '@/domain/repositories/series-read.repository.interface.js';
import { SERIES_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetTitleSeriesService {
    constructor(@Inject(SERIES_READ_REPOSITORY) private readonly series: ISeriesReadRepository) {}

    execute(companyId: string, id: string): Promise<SeriesView> {
        return requireSeriesView(this.series, companyId, id);
    }
}
