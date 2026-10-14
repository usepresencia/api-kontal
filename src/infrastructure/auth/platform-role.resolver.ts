import { Inject, Injectable } from '@nestjs/common';
import type { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformAccessEntity } from '@/domain/entities/platform-access.entity.js';
import type { IPlatformAccessRepository } from '@/domain/repositories/platform-access.repository.interface.js';
import { platformRoleClaimSchema } from '@/infrastructure/auth/platform-role-claim.schema.js';
import { PLATFORM_ACCESS_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class PlatformRoleResolver {
    constructor(
        @Inject(PLATFORM_ACCESS_REPOSITORY)
        private readonly platformAccess: IPlatformAccessRepository,
    ) {}

    /** Devolve o papel de plataforma persistido; sem registro, provisiona a partir da claim. */
    async resolve(userId: string, claim: unknown): Promise<PlatformRole | null> {
        const existing = await this.platformAccess.findByUserId(userId);
        if (existing) return existing.role;

        const parsed = platformRoleClaimSchema.safeParse(claim);
        if (!parsed.success) return null;

        const created = await this.platformAccess.createIfAbsent(
            PlatformAccessEntity.create({ userId, role: parsed.data }),
        );
        if (created) return parsed.data;
        return (await this.platformAccess.findByUserId(userId))?.role ?? parsed.data;
    }
}
