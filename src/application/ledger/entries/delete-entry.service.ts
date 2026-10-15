import { Inject, Injectable } from '@nestjs/common';
import { reversalJournal } from '@/application/ledger/journal-builder.js';
import { entryNotFound } from '@/application/ledger/require-entry.js';
import { requireLockedTitle } from '@/application/ledger/require-title.js';
import type { IClock } from '@/domain/clock.js';
import { EntryKind } from '@/domain/entities/entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

@Injectable()
export class DeleteEntryService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
    ) {}

    /**
     * Exclui a baixa, reabre o saldo do título e posta o estorno, com o título travado.
     * @throws DomainError ENTRY_NOT_FOUND, ENTRY_DELETE_BLOCKED
     */
    execute(companyId: string, id: string): Promise<void> {
        return this.uow.run(async tx => {
            const found = await tx.entries.find(companyId, id);
            if (!found) throw entryNotFound();
            const title = await requireLockedTitle(tx, companyId, found.titleId);
            const entry = await tx.entries.find(companyId, id);
            if (!entry) throw entryNotFound();
            if (entry.kind === EntryKind.PAYMENT && (await tx.entries.hasWriteOff(title.id))) {
                throw new DomainError(
                    ErrorCode.ENTRY_DELETE_BLOCKED,
                    'Exclua primeiro a baixa por perda do título',
                );
            }
            const original = await tx.journal.find(JournalRefType.SETTLEMENT, entry.id);
            if (!original) {
                throw new DomainError(
                    ErrorCode.INTERNAL_ERROR,
                    'Lançamento da baixa não encontrado',
                );
            }
            const reversal = reversalJournal({
                original,
                referenceType: JournalRefType.SETTLEMENT_REVERSAL,
                referenceId: entry.id,
                eventDate: this.clock.today(),
                description: `Estorno da baixa do título ${title.description}`,
            });
            await tx.entries.delete(entry.id);
            await tx.titles.save(title.revertSettlement(entry.principalAmount));
            await tx.journal.writeAll([reversal]);
        });
    }
}
