import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    IJournalReadRepository,
    JournalView,
} from '@/domain/repositories/journal-read.repository.interface.js';

export function journalNotFound(): DomainError {
    return new DomainError(ErrorCode.JOURNAL_ENTRY_NOT_FOUND, 'Lançamento não encontrado');
}

/**
 * Carrega o lançamento da empresa para leitura.
 * @throws DomainError JOURNAL_ENTRY_NOT_FOUND (inclusive para lançamento de outra empresa)
 */
export async function requireJournalView(
    reads: IJournalReadRepository,
    companyId: string,
    id: string,
): Promise<JournalView> {
    const view = await reads.find(companyId, id);
    if (!view) throw journalNotFound();
    return view;
}
