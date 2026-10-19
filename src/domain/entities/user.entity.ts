import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

export interface UserRow {
    id: string;
    firebaseUid: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    phone: string | null;
    createdAt: Date;
}

export class UserEntity {
    private constructor(
        readonly id: string,
        readonly firebaseUid: string,
        readonly email: string,
        readonly name: string,
        readonly avatarUrl: string | null,
        readonly phone: string | null,
        readonly createdAt: Date,
    ) {}

    /** Cria o usuário exigindo `firebaseUid`, e-mail e nome; o e-mail é guardado em minúsculo. */
    static create(params: {
        id: string;
        firebaseUid: string;
        email: string;
        name: string;
        avatarUrl?: string | null;
        phone?: string | null;
        createdAt?: Date;
    }): UserEntity {
        const email = params.email?.trim().toLowerCase();
        const name = params.name?.trim();
        if (!params.firebaseUid) {
            throw new DomainError(ErrorCode.VALIDATION_ERROR, 'firebaseUid é obrigatório');
        }
        if (!email) throw new DomainError(ErrorCode.VALIDATION_ERROR, 'E-mail é obrigatório');
        if (!name) throw new DomainError(ErrorCode.VALIDATION_ERROR, 'Nome é obrigatório');
        return new UserEntity(
            params.id,
            params.firebaseUid,
            email,
            name,
            params.avatarUrl ?? null,
            params.phone ?? null,
            params.createdAt ?? new Date(),
        );
    }

    static fromPersistence(row: UserRow): UserEntity {
        return new UserEntity(
            row.id,
            row.firebaseUid,
            row.email,
            row.name,
            row.avatarUrl,
            row.phone,
            row.createdAt,
        );
    }
}
