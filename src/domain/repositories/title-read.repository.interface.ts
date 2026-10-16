import type { TitleEntity, TitleStatus } from '@/domain/entities/title.entity.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { Page, PageRequest } from '@/domain/pagination.js';

/** Título com o nome do preset e da contraparte, lidos na mesma consulta. */
export interface TitleView {
    title: TitleEntity;
    presetName: string;
    partyName: string;
}

export interface TitleFilter {
    type?: TitleType;
    status?: TitleStatus;
    presetId?: string;
    partyId?: string;
    seriesId?: string;
    dueFrom?: Date;
    dueTo?: Date;
}

export interface ITitleReadRepository {
    find(companyId: string, id: string): Promise<TitleView | null>;
    list(companyId: string, filter: TitleFilter, page: PageRequest): Promise<Page<TitleView>>;
}
