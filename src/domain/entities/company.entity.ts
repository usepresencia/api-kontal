import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

export interface CompanyRow {
    id: string;
    name: string;
    isActive: boolean;
    createdAt: Date;
}

export class CompanyEntity {
    private constructor(
        readonly id: string,
        readonly name: string,
        readonly isActive: boolean,
        readonly createdAt: Date,
    ) {}

    /** Cria a empresa (ativa por padrão) exigindo nome. */
    static create(params: {
        id: string;
        name: string;
        isActive?: boolean;
        createdAt?: Date;
    }): CompanyEntity {
        const name = params.name?.trim();
        if (!name) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Nome da empresa é obrigatório');
        }
        return new CompanyEntity(
            params.id,
            name,
            params.isActive ?? true,
            params.createdAt ?? new Date(),
        );
    }

    static fromPersistence(row: CompanyRow): CompanyEntity {
        return new CompanyEntity(row.id, row.name, row.isActive, row.createdAt);
    }
}
