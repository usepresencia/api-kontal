import type { TitleEntity } from '@/domain/entities/title.entity.js';
import { formatMoney } from '@/domain/money.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

/** Resposta da API para um título: valores em texto, datas YYYY-MM-DD e saldo em aberto. */
export function toTitleResponse(
    title: TitleEntity,
    presetName: string | null,
    partyName: string | null,
) {
    return {
        id: title.id,
        presetId: title.presetId,
        presetName,
        partyId: title.partyId,
        partyName,
        controlAccountId: title.controlAccountId,
        resultAccountId: title.resultAccountId,
        seriesId: title.seriesId,
        seriesIndex: title.seriesIndex,
        type: title.type,
        status: title.status,
        description: title.description,
        amount: formatMoney(title.amount),
        settledAmount: formatMoney(title.settledAmount),
        remainingAmount: formatMoney(title.remainingAmount),
        issueDate: toIsoDate(title.issueDate),
        expirationDate: toIsoDate(title.expirationDate),
        feesPercentageMonthly: title.feesPercentageMonthly,
        isOpening: title.isOpening,
        openingDate: title.openingDate ? toIsoDate(title.openingDate) : null,
        createdAt: title.createdAt.toISOString(),
    };
}
