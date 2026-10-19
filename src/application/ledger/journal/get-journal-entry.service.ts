import { Inject, Injectable } from '@nestjs/common';
import { requireJournalView } from '@/application/ledger/journal/require-journal.js';
import type {
    IJournalReadRepository,
    JournalView,
} from '@/domain/repositories/journal-read.repository.interface.js';
import { JOURNAL_READ_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class GetJournalEntryService {
    constructor(@Inject(JOURNAL_READ_REPOSITORY) private readonly reads: IJournalReadRepository) {}

    execute(companyId: string, id: string): Promise<JournalView> {
        return requireJournalView(this.reads, companyId, id);
    }
}
