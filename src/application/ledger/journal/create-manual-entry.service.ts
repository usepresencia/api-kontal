import { Inject, Injectable } from '@nestjs/common';
import { manualJournal } from '@/application/ledger/journal-builder.js';
import { requireJournalView } from '@/application/ledger/journal/require-journal.js';
import type { IClock } from '@/domain/clock.js';
import {
    assertManualAccounts,
    assertManualDate,
    assertManualLines,
} from '@/domain/ledger/manual-entry.policy.js';
import type { Cents } from '@/domain/money.js';
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

export interface ManualEntryInput {
    date: Date;
    description: string;
    lines: { accountId: string; debit?: Cents; credit?: Cents; memo?: string }[];
}

@Injectable()
export class CreateManualEntryService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
        @Inject(JOURNAL_READ_REPOSITORY) private readonly reads: IJournalReadRepository,
    ) {}

    /**
     * Grava um lançamento manual balanceado em contas analíticas do mesmo plano.
     * @throws DomainError MANUAL_ENTRY_DATE_INVALID, MANUAL_ENTRY_UNBALANCED,
     *   MANUAL_ENTRY_ACCOUNT_INVALID, MANUAL_ENTRY_CONTROL_ACCOUNT
     */
    async execute(companyId: string, input: ManualEntryInput): Promise<JournalView> {
        assertManualDate(input.date, this.clock.today());
        const lines = input.lines.map(line => ({
            accountId: line.accountId,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
            memo: line.memo ?? '',
        }));
        assertManualLines(lines);
        const id = await this.uow.run(async tx => {
            const accountIds = [...new Set(lines.map(line => line.accountId))];
            const refs = await tx.accounts.findRefs(companyId, accountIds);
            const controls = await tx.accounts.controlAccountIds(companyId, accountIds);
            assertManualAccounts(accountIds, refs, controls);
            const entry = manualJournal({
                companyId,
                date: input.date,
                description: input.description,
                lines,
            });
            await tx.journal.writeAll([entry]);
            return entry.id;
        });
        return requireJournalView(this.reads, companyId, id);
    }
}
