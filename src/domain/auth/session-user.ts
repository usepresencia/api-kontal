import type { MembershipRole } from '@/domain/auth/membership-role.js';
import type { PlatformRole } from '@/domain/auth/platform-role.js';

export interface SessionUserMembership {
    companyId: string;
    role: MembershipRole;
    isActive: boolean;
    company: { id: string; name: string };
}

interface SessionUserBase {
    userId: string;
    firebaseUid: string;
    email: string;
    name: string;
    avatarUrl: string | null;
    phone: string | null;
    memberships: SessionUserMembership[];
}

/** Usuário autenticado, colocado em `request.user`. */
export type SessionUser =
    | (SessionUserBase & { isPlatformUser: false; platformRole?: undefined })
    | (SessionUserBase & { isPlatformUser: true; platformRole: PlatformRole });
