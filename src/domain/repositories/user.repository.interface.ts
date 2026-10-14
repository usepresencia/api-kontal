import type { UserEntity } from '@/domain/entities/user.entity.js';

export interface IUserRepository {
    /** Devolve o usuário com o mesmo `firebaseUid` ou cria `candidate`. */
    findOrCreate(candidate: UserEntity): Promise<UserEntity>;
}
