import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type {
    EntryView,
    IEntryReadRepository,
} from '@/domain/repositories/entry-read.repository.interface.js';

export function entryNotFound(): DomainError {
    return new DomainError(ErrorCode.ENTRY_NOT_FOUND, 'Baixa não encontrada');
}

/**
 * Carrega a baixa da empresa para leitura.
 * @throws DomainError ENTRY_NOT_FOUND (inclusive para baixa de outra empresa)
 */
export async function requireEntryView(
    entries: IEntryReadRepository,
    companyId: string,
    id: string,
): Promise<EntryView> {
    const view = await entries.find(companyId, id);
    if (!view) throw entryNotFound();
    return view;
}
