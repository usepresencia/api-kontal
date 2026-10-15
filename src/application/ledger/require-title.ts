import type { TitleEntity } from '@/domain/entities/title.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ILedgerTx } from '@/domain/repositories/ledger.unit-of-work.interface.js';
import type {
    ITitleReadRepository,
    TitleView,
} from '@/domain/repositories/title-read.repository.interface.js';

function notFound(): DomainError {
    return new DomainError(ErrorCode.TITLE_NOT_FOUND, 'Título não encontrado');
}

/**
 * Carrega o título da empresa para leitura.
 * @throws DomainError TITLE_NOT_FOUND (inclusive para título de outra empresa)
 */
export async function requireTitleView(
    titles: ITitleReadRepository,
    companyId: string,
    id: string,
): Promise<TitleView> {
    const view = await titles.find(companyId, id);
    if (!view) throw notFound();
    return view;
}

/**
 * Trava e carrega o título da empresa dentro da transação.
 * @throws DomainError TITLE_NOT_FOUND
 */
export async function requireLockedTitle(
    tx: ILedgerTx,
    companyId: string,
    id: string,
): Promise<TitleEntity> {
    const title = await tx.titles.lock(companyId, id);
    if (!title) throw notFound();
    return title;
}
