import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { resolveDestination } from '@/application/ledger/destination-account.js';
import { creationJournal } from '@/application/ledger/journal-builder.js';
import type { IClock } from '@/domain/clock.js';
import { SeriesEntity } from '@/domain/entities/series.entity.js';
import { TitleEntity } from '@/domain/entities/title.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { resolveTitleAccounts } from '@/domain/ledger/posting.policy.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { Cents } from '@/domain/money.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import {
    buildInstallments,
    buildRecurrences,
    SeriesFrequency,
    SeriesKind,
} from '@/domain/series/series-schedule.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';
import { CLOCK } from '@/infrastructure/time/time.tokens.js';

export interface CreateTitleSeriesInput {
    kind: SeriesKind;
    presetId: string;
    type: TitleType;
    description: string;
    amount: Cents;
    issueDate?: Date;
    expirationDate: Date;
    feesPercentageMonthly?: number;
    frequency?: SeriesFrequency;
    count?: number;
    until?: Date;
    destinationAccountId?: string;
}

export interface SeriesResult {
    series: SeriesEntity;
    titles: TitleEntity[];
}

@Injectable()
export class CreateTitleSeriesService {
    constructor(
        @Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork,
        @Inject(CLOCK) private readonly clock: IClock,
    ) {}

    /**
     * Gera a série (parcelado ou recorrente): os títulos e seus lançamentos de criação, em lote,
     * na mesma transação.
     * @throws DomainError PRESET_NOT_FOUND, PRESET_INACTIVE, TITLE_NOT_POSTABLE, SERIES_INVALID,
     *   SERIES_LIMIT_EXCEEDED
     */
    execute(companyId: string, input: CreateTitleSeriesInput): Promise<SeriesResult> {
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
            const accounts = resolveTitleAccounts(input.type, preset.accounts, destination);
            const today = this.clock.today();
            const issueDate = input.issueDate ?? today;
            const frequency = input.frequency ?? SeriesFrequency.MONTHLY;
            const occurrences = this.schedule(input, frequency, issueDate);
            const series = SeriesEntity.create({
                id: randomUUID(),
                companyId,
                kind: input.kind,
                frequency,
                totalCount: occurrences.length,
                baseDescription: input.description,
                firstIssueDate: issueDate,
                firstExpirationDate: input.expirationDate,
            });
            const titles = occurrences.map(item =>
                TitleEntity.create({
                    id: randomUUID(),
                    companyId,
                    presetId: preset.id,
                    accounts,
                    type: input.type,
                    description: item.description,
                    amount: item.amount,
                    today,
                    issueDate: item.issueDate,
                    expirationDate: item.expirationDate,
                    feesPercentageMonthly: input.feesPercentageMonthly,
                    seriesId: series.id,
                    seriesIndex: item.index,
                }),
            );
            await tx.series.insert(series);
            await tx.titles.insertAll(titles);
            await tx.journal.writeAll(titles.map(creationJournal));
            return { series, titles };
        });
    }

    private schedule(input: CreateTitleSeriesInput, frequency: SeriesFrequency, issueDate: Date) {
        if (input.kind === SeriesKind.RECURRING) {
            return buildRecurrences({
                description: input.description,
                amount: input.amount,
                frequency,
                firstIssueDate: issueDate,
                firstDue: input.expirationDate,
                count: input.count,
                until: input.until,
                startIndex: 1,
            });
        }
        if (input.count === undefined || input.until !== undefined) {
            throw new DomainError(
                ErrorCode.SERIES_INVALID,
                'Parcelado exige a quantidade de parcelas e não aceita data final',
            );
        }
        return buildInstallments({
            description: input.description,
            total: input.amount,
            count: input.count,
            frequency,
            issueDate,
            firstDue: input.expirationDate,
        });
    }
}
