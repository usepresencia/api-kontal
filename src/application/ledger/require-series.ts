import type { SeriesEntity } from '@/domain/entities/series.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ILedgerTx } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import type {
    ISeriesReadRepository,
    SeriesView,
} from '@/domain/repositories/series-read.repository.interface.js';

function notFound(): DomainError {
    return new DomainError(ErrorCode.SERIES_NOT_FOUND, 'Série não encontrada');
}

/**
 * Carrega a série da empresa para leitura.
 * @throws DomainError SERIES_NOT_FOUND (inclusive para série de outra empresa)
 */
export async function requireSeriesView(
    series: ISeriesReadRepository,
    companyId: string,
    id: string,
): Promise<SeriesView> {
    const view = await series.find(companyId, id);
    if (!view) throw notFound();
    return view;
}

/**
 * Trava e carrega a série da empresa dentro da transação.
 * @throws DomainError SERIES_NOT_FOUND
 */
export async function requireLockedSeries(
    tx: ILedgerTx,
    companyId: string,
    id: string,
): Promise<SeriesEntity> {
    const series = await tx.series.lock(companyId, id);
    if (!series) throw notFound();
    return series;
}
