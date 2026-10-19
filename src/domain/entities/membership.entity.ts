import type { MembershipRole } from '@/domain/auth/membership-role.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

export interface MembershipRow {
    id: string;
    companyId: string;
    userId: string;
    role: MembershipRole;
    isActive: boolean;
    joinedAt: Date;
}

export class MembershipEntity {
    private constructor(
        readonly id: string,
        readonly companyId: string,
        readonly userId: string,
        readonly role: MembershipRole,
        readonly isActive: boolean,
        readonly joinedAt: Date,
    ) {}

    /** Cria o vínculo (ativo por padrão) exigindo `companyId` e `userId`. */
    static create(params: {
        id: string;
        companyId: string;
        userId: string;
        role: MembershipRole;
        isActive?: boolean;
        joinedAt?: Date;
    }): MembershipEntity {
        if (!params.companyId) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'companyId é obrigatório');
        }
        if (!params.userId) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'userId é obrigatório');
        }
        return new MembershipEntity(
            params.id,
            params.companyId,
            params.userId,
            params.role,
            params.isActive ?? true,
            params.joinedAt ?? new Date(),
        );
    }

    static fromPersistence(row: MembershipRow): MembershipEntity {
        return new MembershipEntity(
            row.id,
            row.companyId,
            row.userId,
            row.role,
            row.isActive,
            row.joinedAt,
        );
    }
}
