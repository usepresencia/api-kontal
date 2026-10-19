import type { PartyEntity } from '@/domain/entities/party.entity.js';
import type { TitleType } from '@/domain/ledger/title-type.js';
import type { Page, PageRequest } from '@/domain/pagination.js';
import type { PartyKind } from '@/domain/parties/party-kind.js';

/** Contraparte com o nome do preset padrão, lido na mesma consulta. */
export interface PartyView {
    party: PartyEntity;
    defaultPresetName: string | null;
}

export interface PartyFilter {
    kind?: PartyKind;
    isActive?: boolean;
    search?: string;
}

export interface IPartyRepository {
    create(party: PartyEntity): Promise<void>;
    /** Devolve a contraparte só se for do tenant. */
    findById(companyId: string, id: string): Promise<PartyView | null>;
    list(companyId: string, filter: PartyFilter, page: PageRequest): Promise<Page<PartyView>>;
    update(companyId: string, party: PartyEntity): Promise<void>;
    /** Indica se o tenant já tem uma contraparte com o documento, ignorando o id informado. */
    documentTaken(companyId: string, document: string, exceptId?: string): Promise<boolean>;
    /** Indica se a contraparte tem títulos do tipo informado. */
    hasTitlesOfType(id: string, type: TitleType): Promise<boolean>;
    /** Indica se algum título usa a contraparte. */
    isInUse(id: string): Promise<boolean>;
    delete(companyId: string, id: string): Promise<void>;
    /** Indica se alguma contraparte usa o preset como padrão. */
    presetInUse(presetId: string): Promise<boolean>;
}
