import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import {
    PRESET_ROLES,
    type PresetAccountIds,
    REQUIRED_PRESET_ROLES,
} from '@/domain/ledger/preset-roles.js';
import { optionalText, requiredText } from '@/domain/required-text.js';

export interface PresetRow {
    id: string;
    billingPlanId: string;
    name: string;
    description: string;
    isActive: boolean;
    accounts: PresetAccountIds;
    createdAt: Date;
}

function normalizeAccounts(input: Partial<PresetAccountIds>): PresetAccountIds {
    const accounts = {} as PresetAccountIds;
    for (const role of PRESET_ROLES) {
        const id = input[role] || null;
        if (!id && REQUIRED_PRESET_ROLES.includes(role)) {
            throw new DomainError(
                ErrorCode.PRESET_ACCOUNT_INVALID,
                `A conta do papel "${role}" é obrigatória`,
            );
        }
        accounts[role] = id;
    }
    return accounts;
}

/** Atalho de lançamento: reúne as contas que um título usa na contabilidade. */
export class PresetEntity {
    private constructor(
        readonly id: string,
        readonly billingPlanId: string,
        readonly name: string,
        readonly description: string,
        readonly isActive: boolean,
        readonly accounts: PresetAccountIds,
        readonly createdAt: Date,
    ) {}

    static create(params: {
        id: string;
        billingPlanId: string;
        name: string;
        description?: string;
        isActive?: boolean;
        accounts: Partial<PresetAccountIds>;
        createdAt?: Date;
    }): PresetEntity {
        return new PresetEntity(
            params.id,
            params.billingPlanId,
            requiredText(params.name, 'Nome do preset'),
            optionalText(params.description, 'Descrição'),
            params.isActive ?? true,
            normalizeAccounts(params.accounts),
            params.createdAt ?? new Date(),
        );
    }

    /** Substitui nome, descrição, status e contas; preserva id, plano e criação. */
    withChanges(changes: {
        name: string;
        description?: string;
        isActive?: boolean;
        accounts: Partial<PresetAccountIds>;
    }): PresetEntity {
        return new PresetEntity(
            this.id,
            this.billingPlanId,
            requiredText(changes.name, 'Nome do preset'),
            optionalText(changes.description, 'Descrição'),
            changes.isActive ?? this.isActive,
            normalizeAccounts(changes.accounts),
            this.createdAt,
        );
    }

    /** Ids das contas usadas pelo preset, sem os papéis vazios. */
    accountIds(): string[] {
        return PRESET_ROLES.map(role => this.accounts[role]).filter(
            (id): id is string => id !== null,
        );
    }

    static fromPersistence(row: PresetRow): PresetEntity {
        return new PresetEntity(
            row.id,
            row.billingPlanId,
            row.name,
            row.description,
            row.isActive,
            row.accounts,
            row.createdAt,
        );
    }
}
