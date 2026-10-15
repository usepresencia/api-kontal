import type { Page, PageRequest } from '@/domain/pagination.js';
import type { DayTotals } from '@/domain/reports/daily-journal.js';
import type { JournalView } from '@/domain/repositories/journal-read.repository.interface.js';

export interface IDailyJournalRepository {
    /** Dias com lançamentos no plano entre `start` e `end` (inclusivos), em ordem crescente. */
    days(
        companyId: string,
        planId: string,
        start: Date,
        end: Date,
        page: PageRequest,
    ): Promise<Page<DayTotals>>;
    /** Lançamentos com linhas no plano nas datas informadas, por data e número. */
    entriesOn(companyId: string, planId: string, dates: readonly Date[]): Promise<JournalView[]>;
}
