import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { UserEntity } from '@/domain/entities/user.entity.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { IUserRepository } from '@/domain/repositories/user.repository.interface.js';
import { USER_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

@Injectable()
export class UserProvisioner {
    constructor(@Inject(USER_REPOSITORY) private readonly users: IUserRepository) {}

    /**
     * Devolve o usuário do token, criando-o no primeiro login.
     * @throws CodedHttpException 401 se o token não traz e-mail
     */
    async provision(decoded: DecodedIdToken): Promise<UserEntity> {
        const email = decoded.email;
        if (!email) {
            throw new CodedHttpException(401, ErrorCode.UNAUTHORIZED, 'Token sem e-mail');
        }
        return this.users.findOrCreate(
            UserEntity.create({
                id: randomUUID(),
                firebaseUid: decoded.uid,
                email,
                name: decoded.name ?? (email.split('@')[0] || 'User'),
                avatarUrl: decoded.picture ?? null,
                phone: decoded.phone_number ?? null,
            }),
        );
    }
}
