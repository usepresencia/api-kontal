import type { EntryEntity } from '@/domain/entities/entry.entity.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

/** Baixa com a descrição e o tipo do título e o nome da conta, lidos na mesma consulta. */
export interface EntryView {
    entry: EntryEntity;
    titleDescription: string;
    titleType: TitleType;
    billingAccountName: string | null;
}

export interface EntryFilter {
    titleId?: string;
    billingAccountId?: string;
    titleType?: TitleType;
    paidFrom?: Date;
    paidTo?: Date;
}

export interface IEntryReadRepository {
    find(companyId: string, id: string): Promise<EntryView | null>;
    list(companyId: string, filter: EntryFilter, page: PageRequest): Promise<Page<EntryView>>;
}
