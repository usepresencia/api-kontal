import type { PlatformAccessEntity } from '@/domain/entities/platform-access.entity.js';

export interface IPlatformAccessRepository {
    findByUserId(userId: string): Promise<PlatformAccessEntity | null>;
    /** Cria o acesso; devolve `false` se já existia. */
    createIfAbsent(access: PlatformAccessEntity): Promise<boolean>;
}
