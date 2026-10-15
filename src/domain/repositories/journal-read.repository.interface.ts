import type { JournalEntryEntity } from '@/domain/entities/journal-entry.entity.js';
import type { JournalRefType } from '@/domain/ledger/journal-ref-type.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

export interface AccountLabel {
    code: string;
    name: string;
}

/** Lançamento com número, código e nome das contas e o estorno manual que o anulou. */
export interface JournalView {
    entry: JournalEntryEntity;
    number: number;
    accounts: Record<string, AccountLabel>;
    reversedBy: string | null;
}

export interface JournalFilter {
    from?: Date;
    to?: Date;
    referenceType?: JournalRefType;
    referenceId?: string;
    accountId?: string;
}

export interface IJournalReadRepository {
    find(companyId: string, id: string): Promise<JournalView | null>;
    list(companyId: string, filter: JournalFilter, page: PageRequest): Promise<Page<JournalView>>;
}
