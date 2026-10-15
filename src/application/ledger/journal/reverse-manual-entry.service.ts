import { Inject, Injectable } from '@nestjs/common';
import { manualReversalJournal } from '@/application/ledger/journal-builder.js';
import {
    journalNotFound,
    requireJournalView,
} from '@/application/ledger/journal/require-journal.js';
import type { IClock } from '@/domain/clock.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import { assertReversible } from '@/domain/ledger/manual-entry.policy.js';
import type {
    IJournalReadRepository,
    JournalView,
} from '@/domain/repositories/journal-read.repository.interface.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    JOURNAL_READ_REPOSITORY,
    LEDGER_UNIT_OF_WORK,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

@Injectable()
export class ReverseManualEntryService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
        @Inject(JOURNAL_READ_REPOSITORY) private readonly reads: IJournalReadRepository,
    ) {}

    /**
     * Estorna um lançamento manual (uma vez) e devolve o estorno.
     * @throws DomainError JOURNAL_ENTRY_NOT_FOUND, JOURNAL_NOT_REVERSIBLE, JOURNAL_ALREADY_REVERSED
     */
    async execute(
        companyId: string,
        id: string,
        input: { description?: string },
    ): Promise<JournalView> {
        const reversalId = await this.uow.run(async tx => {
            const original = await tx.journal.lock(companyId, id);
            if (!original) throw journalNotFound();
            const existing =
                original.referenceType === JournalRefType.MANUAL
                    ? await tx.journal.find(JournalRefType.MANUAL_REVERSAL, original.id)
                    : null;
            assertReversible(original, existing !== null);
            const reversal = manualReversalJournal({
                original,
                today: this.clock.today(),
                description: input.description,
            });
            await tx.journal.writeAll([reversal]);
            return reversal.id;
        });
        return requireJournalView(this.reads, companyId, reversalId);
    }
}
