import { Inject, Injectable } from '@nestjs/common';
import { reversalJournal } from '@/application/ledger/journal-builder.js';
import { requireLockedTitle } from '@/application/ledger/require-title.js';
import type { IClock } from '@/domain/clock.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

@Injectable()
export class DeleteTitleService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
    ) {}

    /**
     * Exclui o título sem baixas, postando o estorno do lançamento de criação.
     * @throws DomainError TITLE_HAS_ENTRIES
     */
    execute(companyId: string, id: string): Promise<void> {
        return this.uow.run(async tx => {
            const title = await requireLockedTitle(tx, companyId, id);
            if ((await tx.titles.countEntries(id)) > 0) {
                throw new DomainError(
                    ErrorCode.TITLE_HAS_ENTRIES,
                    'Exclusão bloqueada: o título possui baixas',
                );
            }
            const original = await tx.journal.find(JournalRefType.TITLE_CREATION, id);
            if (!original) {
                throw new DomainError(
                    ErrorCode.INTERNAL_ERROR,
                    'Lançamento de criação do título não encontrado',
                );
            }
            await tx.journal.writeAll([
                reversalJournal({
                    original,
                    referenceType: JournalRefType.TITLE_CANCELLATION,
                    referenceId: id,
                    eventDate: this.clock.today(),
                    description: `Título: ${title.description} - cancelamento`,
                }),
            ]);
            await tx.titles.deleteAll([id]);
        });
    }
}
