import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { chargeAccounts } from '@/application/ledger/charge-accounts.js';
import { settlementJournal } from '@/application/ledger/journal-builder.js';
import { requireLockedTitle } from '@/application/ledger/require-title.js';
import type { IClock } from '@/domain/clock.js';
import { EntryEntity } from '@/domain/entities/entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { writeOffLines } from '@/domain/ledger/posting.policy.js';
import type { EntryView } from '@/domain/repositories/entry-read.repository.interface.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

@Injectable()
export class WriteOffTitleService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
    ) {}

    /**
     * Encerra o saldo em aberto como perda e grava o lançamento na mesma transação.
     * @throws DomainError TITLE_NOT_OPEN, SETTLEMENT_NOT_POSTABLE, ENTRY_DATE_INVALID
     */
    execute(
        companyId: string,
        id: string,
        input: { paidAt?: Date; description?: string },
    ): Promise<EntryView> {
        return this.uow.run(async tx => {
            const title = await requireLockedTitle(tx, companyId, id);
            const preset = await tx.presets.find(companyId, title.presetId);
            if (!preset) throw new DomainError(ErrorCode.PRESET_NOT_FOUND, 'Preset não encontrado');
            const written = title.applyWriteOff();
            const entry = EntryEntity.writeOff({
                id: randomUUID(),
                titleId: title.id,
                principal: title.remainingAmount,
                paidAt: input.paidAt,
                description: input.description,
                issueDate: title.issueDate,
                today: this.clock.today(),
            });
            const journal = settlementJournal({
                title,
                entryId: entry.id,
                date: entry.paidAt,
                description: `Baixa por perda do título ${title.description}`,
                lines: writeOffLines(
                    {
                        type: title.type,
                        controlAccountId: title.controlAccountId,
                        resultAccountId: title.resultAccountId,
                    },
                    entry.principalAmount,
                    chargeAccounts(preset),
                    title.description,
                ),
            });
            await tx.entries.insert(entry);
            await tx.titles.save(written);
            await tx.journal.writeAll([journal]);
            return {
                entry,
                titleDescription: title.description,
                titleType: title.type,
                billingAccountName: null,
            };
        });
    }
}
