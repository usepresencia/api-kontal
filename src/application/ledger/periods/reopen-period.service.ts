import { Inject, Injectable } from '@nestjs/common';
import { closingReversalJournal } from '@/application/ledger/journal-builder.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ReopenPeriodService {
    constructor(@Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork) {}

    /**
     * Reabre o último fechamento, com a empresa travada: estorna a apuração (se houver) na mesma
     * data, apaga o registro e devolve a trava ao fechamento anterior.
     * @throws DomainError COMPANY_NOT_FOUND, PERIOD_CLOSING_NOT_FOUND
     */
    execute(companyId: string): Promise<void> {
        return this.uow.run(async tx => {
            if (!(await tx.periods.lockCompany(companyId))) {
                throw new DomainError(ErrorCode.COMPANY_NOT_FOUND, 'Empresa não encontrada');
            }
            const latest = await tx.periods.latest(companyId);
            if (!latest) {
                throw new DomainError(
                    ErrorCode.PERIOD_CLOSING_NOT_FOUND,
                    'Não há fechamento para reabrir',
                );
            }
            if (latest.closingEntryId) {
                const original = await tx.journal.find(JournalRefType.CLOSING, latest.id);
                if (!original) {
                    throw new DomainError(
                        ErrorCode.INTERNAL_ERROR,
                        'Lançamento de apuração não encontrado',
                    );
                }
                await tx.journal.writeAll([closingReversalJournal(original)]);
            }
            await tx.periods.delete(latest.id);
            const previous = await tx.periods.latest(companyId);
            await tx.periods.setClosedThrough(companyId, previous?.throughDate ?? null);
        });
    }
}
