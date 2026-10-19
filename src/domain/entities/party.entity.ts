import type { TitleType } from '@/domain/ledger/title-type.js';
import { normalizePartyDocument } from '@/domain/parties/party-document.js';
import { PartyKind } from '@/domain/parties/party-kind.js';
import { optionalText, requiredText } from '@/domain/required-text.js';

export interface PartyAddress {
    zipCode: string;
    street: string;
    number: string;
    complement: string | null;
    neighborhood: string;
    city: string;
    state: string;
}

export interface PartyRow {
    id: string;
    companyId: string;
    kind: PartyKind;
    name: string;
    socialReason: string;
    document: string;
    email: string;
    phone: string;
    address: PartyAddress | null;
    isActive: boolean;
    defaultPresetId: string | null;
    createdAt: Date;
}

export interface PartyInput {
    kind: PartyKind;
    name: string;
    socialReason: string;
    document: string;
    email: string;
    phone: string;
    address: PartyAddress | null;
    isActive?: boolean;
    defaultPresetId: string | null;
}

function normalize(input: PartyInput) {
    return {
        kind: input.kind,
        name: requiredText(input.name, 'Nome da contraparte'),
        socialReason: requiredText(input.socialReason, 'Razão social'),
        document: normalizePartyDocument(input.document),
        email: optionalText(input.email, 'E-mail'),
        phone: optionalText(input.phone, 'Telefone', 20),
        address: input.address,
        defaultPresetId: input.defaultPresetId,
    };
}

/** Cliente ou fornecedor do tenant, com o preset contábil padrão dos seus títulos. */
export class PartyEntity {
    private constructor(private readonly row: PartyRow) {}

    static create(params: PartyInput & { id: string; companyId: string; createdAt?: Date }) {
        return new PartyEntity({
            id: params.id,
            companyId: params.companyId,
            ...normalize(params),
            isActive: params.isActive ?? true,
            createdAt: params.createdAt ?? new Date(),
        });
    }

    /** Reconstrói a entidade de uma linha já validada do banco. */
    static fromPersistence(row: PartyRow): PartyEntity {
        return new PartyEntity(row);
    }

    /** Substitui os dados editáveis; preserva id, tenant e data de criação. */
    withChanges(changes: PartyInput): PartyEntity {
        return new PartyEntity({
            ...this.row,
            ...normalize(changes),
            isActive: changes.isActive ?? this.row.isActive,
        });
    }

    /** Indica se a contraparte pode ter títulos do tipo informado. */
    canTransact(titleType: TitleType): boolean {
        if (this.row.kind === PartyKind.BOTH) return true;
        return this.row.kind === (titleType === 'EXPENSE' ? PartyKind.SUPPLIER : PartyKind.CLIENT);
    }

    get id(): string {
        return this.row.id;
    }
    get companyId(): string {
        return this.row.companyId;
    }
    get kind(): PartyKind {
        return this.row.kind;
    }
    get name(): string {
        return this.row.name;
    }
    get socialReason(): string {
        return this.row.socialReason;
    }
    get document(): string {
        return this.row.document;
    }
    get email(): string {
        return this.row.email;
    }
    get phone(): string {
        return this.row.phone;
    }
    get address(): PartyAddress | null {
        return this.row.address;
    }
    get isActive(): boolean {
        return this.row.isActive;
    }
    get defaultPresetId(): string | null {
        return this.row.defaultPresetId;
    }
    get createdAt(): Date {
        return this.row.createdAt;
    }
}
