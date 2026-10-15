import { Inject, Injectable } from '@nestjs/common';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    ITitleReadRepository,
    TitleFilter,
    TitleView,
} from '@/domain/repositories/title-read.repository.interface.js';
import { TITLE_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListTitlesService {
    constructor(@Inject(TITLE_READ_REPOSITORY) private readonly titles: ITitleReadRepository) {}

    execute(companyId: string, filter: TitleFilter, page: PageRequest): Promise<Page<TitleView>> {
        return this.titles.list(companyId, filter, page);
    }
}
