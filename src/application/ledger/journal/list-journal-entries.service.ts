import { Inject, Injectable } from '@nestjs/common';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    IJournalReadRepository,
    JournalFilter,
    JournalView,
} from '@/domain/repositories/journal-read.repository.interface.js';
import { JOURNAL_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListJournalEntriesService {
    constructor(@Inject(JOURNAL_READ_REPOSITORY) private readonly reads: IJournalReadRepository) {}

    /**
     * Lista os lançamentos da empresa, do mais recente ao mais antigo.
     * @throws DomainError DATE_RANGE_INVALID se `from` for posterior a `to`
     */
    async execute(
        companyId: string,
        filter: JournalFilter,
        page: PageRequest,
    ): Promise<Page<JournalView>> {
        if (filter.from && filter.to) assertDateRange(filter.from, filter.to);
        return this.reads.list(companyId, filter, page);
    }
}
