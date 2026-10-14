import type { PlatformRole } from '@/domain/auth/platform-role.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

export interface PlatformAccessRow {
    userId: string;
    role: PlatformRole;
}

export class PlatformAccessEntity {
    private constructor(
        readonly userId: string,
        readonly role: PlatformRole,
    ) {}

    /** Cria o acesso de plataforma exigindo `userId`. */
    static create(params: { userId: string; role: PlatformRole }): PlatformAccessEntity {
        if (!params.userId) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'userId é obrigatório');
        }
        return new PlatformAccessEntity(params.userId, params.role);
    }

    static fromPersistence(row: PlatformAccessRow): PlatformAccessEntity {
        return new PlatformAccessEntity(row.userId, row.role);
    }
}
