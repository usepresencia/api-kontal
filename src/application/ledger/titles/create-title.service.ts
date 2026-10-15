import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { resolveDestination } from '@/application/ledger/destination-account.js';
import { creationJournal } from '@/application/ledger/journal-builder.js';
import type { IClock } from '@/domain/clock.js';
import { TitleEntity } from '@/domain/entities/title.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { resolveTitleAccounts } from '@/domain/ledger/posting.policy.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { Cents } from '@/domain/money.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import type { TitleView } from '@/domain/repositories/title-read.repository.interface.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

export interface CreateTitleInput {
    presetId: string;
    type: TitleType;
    description: string;
    amount: Cents;
    issueDate?: Date;
    expirationDate: Date;
    feesPercentageMonthly?: number;
    destinationAccountId?: string;
}

@Injectable()
export class CreateTitleService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
    ) {}

    /**
     * Cria o título com as contas do preset e grava o lançamento de criação na mesma transação.
     * @throws DomainError PRESET_NOT_FOUND, PRESET_INACTIVE, TITLE_NOT_POSTABLE,
     *   DESTINATION_ACCOUNT_INVALID
     */
    execute(companyId: string, input: CreateTitleInput): Promise<TitleView> {
        return this.uow.run(async tx => {
            const preset = await tx.presets.find(companyId, input.presetId);
            if (!preset) throw new DomainError(ErrorCode.PRESET_NOT_FOUND, 'Preset não encontrado');
            if (!preset.isActive) {
                throw new DomainError(ErrorCode.PRESET_INACTIVE, 'O preset está inativo');
            }
            const destination = await resolveDestination(
                tx,
                companyId,
                preset,
                input.type,
                input.destinationAccountId,
            );
            const title = TitleEntity.create({
                id: randomUUID(),
                companyId,
                presetId: preset.id,
                accounts: resolveTitleAccounts(input.type, preset.accounts, destination),
                type: input.type,
                description: input.description,
                amount: input.amount,
                today: this.clock.today(),
                issueDate: input.issueDate,
                expirationDate: input.expirationDate,
                feesPercentageMonthly: input.feesPercentageMonthly,
            });
            await tx.titles.insertAll([title]);
            await tx.journal.writeAll([creationJournal(title)]);
            return { title, presetName: preset.name };
        });
    }
}
