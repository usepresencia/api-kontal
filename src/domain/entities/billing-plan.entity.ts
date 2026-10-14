import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { requiredText } from '@/domain/required-text.js';

export interface BillingPlanRow {
    id: string;
    companyId: string;
    name: string;
    description: string;
    createdAt: Date;
}

function normalizeDescription(description: string | undefined): string {
    const text = description?.trim() ?? '';
    if (text.length > 255) {
        throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Descrição excede 255 caracteres');
    }
    return text;
}

export class BillingPlanEntity {
    private constructor(
        readonly id: string,
        readonly companyId: string,
        readonly name: string,
        readonly description: string,
        readonly createdAt: Date,
    ) {}

    static create(params: {
        id: string;
        companyId: string;
        name: string;
        description?: string;
        createdAt?: Date;
    }): BillingPlanEntity {
        if (!params.companyId) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'companyId é obrigatório');
        }
        return new BillingPlanEntity(
            params.id,
            params.companyId,
            requiredText(params.name, 'Nome do plano'),
            normalizeDescription(params.description),
            params.createdAt ?? new Date(),
        );
    }

    withChanges(changes: { name: string; description?: string }): BillingPlanEntity {
        return new BillingPlanEntity(
            this.id,
            this.companyId,
            requiredText(changes.name, 'Nome do plano'),
            normalizeDescription(changes.description),
            this.createdAt,
        );
    }

    static fromPersistence(row: BillingPlanRow): BillingPlanEntity {
        return new BillingPlanEntity(
            row.id,
            row.companyId,
            row.name,
            row.description,
            row.createdAt,
        );
    }
}
