import { Inject, Injectable } from '@nestjs/common';
import type { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import type { UserEntity } from '@/domain/entities/user.entity.js';
import type { IMembershipRepository } from '@/domain/repositories/membership.repository.interface.js';
import { MEMBERSHIP_REPOSITORY } from '@/infrastructure/persistence/persistence.tokens.js';

@Injectable()
export class SessionUserAssembler {
    constructor(
        @Inject(MEMBERSHIP_REPOSITORY) private readonly memberships: IMembershipRepository,
    ) {}

    /** Monta o `SessionUser` com as memberships ativas do usuário. */
    async assemble(user: UserEntity, platformRole: PlatformRole | null): Promise<SessionUser> {
        const memberships = (await this.memberships.findActiveByUserId(user.id)).map(
            ({ membership, company }) => ({
                companyId: membership.companyId,
                role: membership.role,
                isActive: membership.isActive,
                company: { id: company.id, name: company.name },
            }),
        );
        const base = {
            userId: user.id,
            firebaseUid: user.firebaseUid,
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl,
            phone: user.phone,
            memberships,
        };
        return platformRole
            ? { ...base, isPlatformUser: true, platformRole }
            : { ...base, isPlatformUser: false };
    }
}
