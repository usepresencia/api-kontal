import type { PeriodClosingList } from '@/domain/repositories/period-closing-read.repository.interface.js';
import type { PeriodClosingRow } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import { toIsoDate } from '@/presentation/common/iso-date.js';

export function toPeriodClosingResponse(row: PeriodClosingRow) {
    return {
        id: row.id,
        month: toIsoDate(row.throughDate).slice(0, 7),
        throughDate: toIsoDate(row.throughDate),
        closingEntryId: row.closingEntryId,
        createdAt: row.createdAt.toISOString(),
    };
}

/** Resposta da consulta: a trava vigente (ou null) e os fechamentos. */
export function toPeriodClosingsResponse({ closedThrough, items }: PeriodClosingList) {
    return {
        closedThrough: closedThrough ? toIsoDate(closedThrough) : null,
        items: items.map(toPeriodClosingResponse),
    };
}
