import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { resolveDestination } from '@/application/ledger/destination-account.js';
import { creationJournal } from '@/application/ledger/journal-builder.js';
import type { IClock } from '@/domain/clock.js';
import type { PresetEntity } from '@/domain/entities/preset.entity.js';
import { TitleEntity } from '@/domain/entities/title.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { resolveTitleAccounts } from '@/domain/ledger/posting.policy.js';
import { resolveOpening } from '@/domain/ledger/title-opening.js';
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
    isOpening?: boolean;
    openingDate?: Date;
    settledAmount?: Cents;
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
     *   DESTINATION_ACCOUNT_INVALID, OPENING_TITLE_INVALID
     */
    execute(companyId: string, input: CreateTitleInput): Promise<TitleView> {
        return this.uow.run(async tx => {
            const preset = await tx.presets.find(companyId, input.presetId);
            if (!preset) throw new DomainError(ErrorCode.PRESET_NOT_FOUND, 'Preset não encontrado');
            if (!preset.isActive) {
                throw new DomainError(ErrorCode.PRESET_INACTIVE, 'O preset está inativo');
            }
            const today = this.clock.today();
            const opening = resolveOpening(input, {
                amount: input.amount,
                issueDate: input.issueDate,
                today,
            });
            const resultOverride = opening
                ? this.openingAccount(preset, input.destinationAccountId)
                : await resolveDestination(
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
                accounts: resolveTitleAccounts(input.type, preset.accounts, resultOverride),
                type: input.type,
                description: input.description,
                amount: input.amount,
                today,
                issueDate: input.issueDate,
                expirationDate: input.expirationDate,
                feesPercentageMonthly: input.feesPercentageMonthly,
                opening: opening ?? undefined,
            });
            await tx.titles.insertAll([title]);
            await tx.journal.writeAll([creationJournal(title)]);
            return { title, presetName: preset.name };
        });
    }

    private openingAccount(preset: PresetEntity, destinationAccountId: string | undefined): string {
        if (destinationAccountId !== undefined) {
            throw new DomainError(
                ErrorCode.DESTINATION_ACCOUNT_INVALID,
                'Título de implantação não aceita conta de destino',
            );
        }
        const account = preset.accounts.openingBalance;
        if (!account) {
            throw new DomainError(
                ErrorCode.TITLE_NOT_POSTABLE,
                'O preset precisa da conta de saldos iniciais (openingBalance) para títulos de implantação',
            );
        }
        return account;
    }
}
