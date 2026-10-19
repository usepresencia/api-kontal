import { Inject, Injectable } from '@nestjs/common';
import { assertDateRange } from '@/application/reports/assert-date-range.js';
import { requireTitleView } from '@/application/ledger/require-title.js';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type {
    EntryFilter,
    EntryView,
    IEntryReadRepository,
} from '@/domain/repositories/entry-read.repository.interface.js';
import type { ITitleReadRepository } from '@/domain/repositories/title-read.repository.interface.js';
import {
    ENTRY_READ_REPOSITORY,
    TITLE_READ_REPOSITORY,
} from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ListEntriesService {
    constructor(
        @Inject(ENTRY_READ_REPOSITORY) private readonly entries: IEntryReadRepository,
        @Inject(TITLE_READ_REPOSITORY) private readonly titles: ITitleReadRepository,
    ) {}

    /**
     * Lista as baixas da empresa; com `titleId`, confirma antes que o título é da empresa.
     * @throws DomainError TITLE_NOT_FOUND, DATE_RANGE_INVALID
     */
    async execute(
        companyId: string,
        filter: EntryFilter,
        page: PageRequest,
    ): Promise<Page<EntryView>> {
        if (filter.paidFrom && filter.paidTo) assertDateRange(filter.paidFrom, filter.paidTo);
        if (filter.titleId) await requireTitleView(this.titles, companyId, filter.titleId);
        return this.entries.list(companyId, filter, page);
    }
}
