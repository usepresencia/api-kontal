import { Inject, Injectable } from '@nestjs/common';
import { reversalJournal } from '@/application/ledger/journal-builder.js';
import { requireLockedSeries } from '@/application/ledger/require-series.js';
import type { IClock } from '@/domain/clock.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

@Injectable()
export class CancelTitleSeriesService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
    ) {}

    /**
     * Estorna e exclui, em lote, os títulos da série sem baixas; os que têm baixa permanecem.
     * Remove a série quando não sobra nenhum título.
     * @throws DomainError SERIES_NOT_FOUND
     */
    execute(companyId: string, id: string): Promise<{ cancelled: number; kept: number }> {
        return this.uow.run(async tx => {
            const series = await requireLockedSeries(tx, companyId, id);
            const titles = await tx.series.titles(series.id);
            const withEntries = await tx.titles.idsWithEntries(titles.map(title => title.id));
            const removable = titles.filter(title => !withEntries.has(title.id));
            const kept = titles.length - removable.length;
            if (removable.length === 0) return { cancelled: 0, kept };

            const originals = await tx.journal.findAll(
                JournalRefType.TITLE_CREATION,
                removable.map(title => title.id),
            );
            const byTitle = new Map(originals.map(journal => [journal.referenceId, journal]));
            const today = this.clock.today();
            const reversals = removable.map(title => {
                const original = byTitle.get(title.id);
                if (!original) {
                    throw new DomainError(
                        ErrorCode.INTERNAL_ERROR,
                        'Lançamento de criação do título não encontrado',
                    );
                }
                return reversalJournal({
                    original,
                    referenceType: JournalRefType.TITLE_CANCELLATION,
                    referenceId: title.id,
                    eventDate: today,
                    description: `Título: ${title.description} - cancelamento`,
                });
            });
            await tx.journal.writeAll(reversals);
            await tx.titles.deleteAll(removable.map(title => title.id));
            if (kept === 0) await tx.series.delete(series.id);
            return { cancelled: removable.length, kept };
        });
    }
}
