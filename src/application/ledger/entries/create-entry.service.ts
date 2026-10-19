import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { chargeAccounts } from '@/application/ledger/charge-accounts.js';
import { settlementJournal } from '@/application/ledger/journal-builder.js';
import { requireEntryView } from '@/application/ledger/require-entry.js';
import { requireLockedTitle } from '@/application/ledger/require-title.js';
import type { IClock } from '@/domain/clock.js';
import { EntryEntity, type PaymentMethod } from '@/domain/entities/entry.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { assertSettlementAccount } from '@/domain/ledger/account-compatibility.policy.js';
import { paymentLines } from '@/domain/ledger/posting.policy.js';
import type { Cents } from '@/domain/money.js';
import type {
    EntryView,
    IEntryReadRepository,
} from '@/domain/repositories/entry-read.repository.interface.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    ENTRY_READ_REPOSITORY,
    LEDGER_UNIT_OF_WORK,
} from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

export interface CreateEntryInput {
    billingAccountId: string;
    principal: Cents;
    interest?: Cents;
    fine?: Cents;
    discount?: Cents;
    paidAt: Date;
    paymentMethod: PaymentMethod;
    description?: string;
}

@Injectable()
export class CreateEntryService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
        @Inject(ENTRY_READ_REPOSITORY) private readonly entries: IEntryReadRepository,
    ) {}

    /**
     * Registra o pagamento, abate o saldo e grava o lançamento na mesma transação, com o
     * título travado.
     * @throws DomainError TITLE_NOT_FOUND, TITLE_NOT_OPEN, ENTRY_EXCEEDS_BALANCE,
     *   ENTRY_ACCOUNT_INVALID, ENTRY_DATE_INVALID, ENTRY_AMOUNT_INVALID, SETTLEMENT_NOT_POSTABLE
     */
    async execute(companyId: string, titleId: string, input: CreateEntryInput): Promise<EntryView> {
        const entryId = await this.uow.run(async tx => {
            const title = await requireLockedTitle(tx, companyId, titleId);
            const preset = await tx.presets.find(companyId, title.presetId);
            if (!preset) throw new DomainError(ErrorCode.PRESET_NOT_FOUND, 'Preset não encontrado');
            const [account] = await tx.accounts.findRefs(companyId, [input.billingAccountId]);
            assertSettlementAccount(preset.billingPlanId, title.controlAccountId, account);
            const entry = EntryEntity.payment({
                id: randomUUID(),
                titleId: title.id,
                billingAccountId: input.billingAccountId,
                principal: input.principal,
                interest: input.interest,
                fine: input.fine,
                discount: input.discount,
                paidAt: input.paidAt,
                paymentMethod: input.paymentMethod,
                description: input.description,
                issueDate: title.paymentFloorDate,
                today: this.clock.today(),
            });
            const updated = title.applyPayment(entry.principalAmount);
            const journal = settlementJournal({
                title,
                entryId: entry.id,
                date: entry.paidAt,
                description: `Baixa do título ${title.description}`,
                lines: paymentLines(
                    {
                        type: title.type,
                        controlAccountId: title.controlAccountId,
                        resultAccountId: title.resultAccountId,
                    },
                    input.billingAccountId,
                    entry.amounts,
                    chargeAccounts(preset),
                    title.description,
                ),
            });
            await tx.entries.insert(entry);
            await tx.titles.save(updated);
            await tx.journal.writeAll([journal]);
            return entry.id;
        });
        return requireEntryView(this.entries, companyId, entryId);
    }
}
