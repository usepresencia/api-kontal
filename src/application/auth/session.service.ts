import { Injectable } from '@nestjs/common';
import type { MembershipRole } from '@/domain/auth/membership-role.js';
import type { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';

export interface SessionResponse {
    user: {
        id: string;
        email: string;
        name: string;
        avatarUrl: string | null;
        phone: string | null;
    };
    isPlatformUser: boolean;
    platformRole: PlatformRole | null;
    memberships: {
        companyId: string;
        companyName: string;
        role: MembershipRole;
        isActive: boolean;
    }[];
}

@Injectable()
export class SessionService {
    /** Monta os dados de bootstrap da sessão a partir do usuário autenticado. */
    createSession(user: SessionUser): SessionResponse {
        return {
            user: {
                id: user.userId,
                email: user.email,
                name: user.name,
                avatarUrl: user.avatarUrl,
                phone: user.phone,
            },
            isPlatformUser: user.isPlatformUser,
            platformRole: user.platformRole ?? null,
            memberships: user.memberships.map(m => ({
                companyId: m.companyId,
                companyName: m.company.name,
                role: m.role,
                isActive: m.isActive,
            })),
        };
    }
}
