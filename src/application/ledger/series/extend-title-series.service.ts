import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { requireUsableParty } from '@/application/ledger/resolve-party-preset.js';
import { creationJournal } from '@/application/ledger/journal-builder.js';
import { requireLockedSeries } from '@/application/ledger/require-series.js';
import type { SeriesResult } from '@/application/ledger/series/create-title-series.service.js';
import { TitleEntity } from '@/domain/entities/title.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ILedgerUnitOfWork } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { buildRecurrences } from '@/domain/series/series-schedule.js';
import { LEDGER_UNIT_OF_WORK } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class ExtendTitleSeriesService {
    constructor(@Inject(LEDGER_UNIT_OF_WORK) private readonly uow: ILedgerUnitOfWork) {}

    /**
     * Acrescenta ocorrências a uma recorrência, repetindo preset, contas, valor e juros da última.
     * @throws DomainError SERIES_NOT_FOUND, SERIES_NOT_EXTENDABLE, SERIES_INVALID,
     *   SERIES_LIMIT_EXCEEDED
     */
    execute(
        companyId: string,
        id: string,
        input: { count?: number; until?: Date },
    ): Promise<SeriesResult> {
        return this.uow.run(async tx => {
            const series = await requireLockedSeries(tx, companyId, id);
            series.assertExtendable();
            const last = await tx.series.lastTitle(series.id);
            if (!last) {
                throw new DomainError(ErrorCode.INTERNAL_ERROR, 'A série não tem títulos');
            }
            await requireUsableParty(tx, companyId, last.partyId, last.type);
            const occurrences = buildRecurrences({
                description: series.baseDescription,
                amount: last.amount,
                frequency: series.frequency,
                firstIssueDate: series.firstIssueDate,
                firstDue: series.firstExpirationDate,
                count: input.count,
                until: input.until,
                startIndex: series.totalCount + 1,
            });
            const titles = occurrences.map(item =>
                TitleEntity.create({
                    id: randomUUID(),
                    companyId,
                    presetId: last.presetId,
                    partyId: last.partyId,
                    accounts: {
                        controlAccountId: last.controlAccountId,
                        resultAccountId: last.resultAccountId,
                    },
                    type: last.type,
                    description: item.description,
                    amount: item.amount,
                    today: item.issueDate,
                    issueDate: item.issueDate,
                    expirationDate: item.expirationDate,
                    feesPercentageMonthly: last.feesPercentageMonthly,
                    seriesId: series.id,
                    seriesIndex: item.index,
                }),
            );
            const updated = series.withTotalCount(series.totalCount + titles.length);
            await tx.titles.insertAll(titles);
            await tx.journal.writeAll(titles.map(creationJournal));
            await tx.series.save(updated);
            return { series: updated, titles };
        });
    }
}
