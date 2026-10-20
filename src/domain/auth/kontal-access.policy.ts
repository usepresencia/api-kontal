import { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';

/** Papéis de plataforma com acesso ao Kontal. */
export const KONTAL_PLATFORM_ROLES: readonly PlatformRole[] = [
    PlatformRole.INTERNAL_ADMIN,
    PlatformRole.INTERNAL_BILLING,
];

export function canAccessKontal(role: PlatformRole): boolean {
    return KONTAL_PLATFORM_ROLES.includes(role);
}

/**
 * Acesso ao Kontal: o platform user precisa de um papel liberado; os demais, de ao menos
 * uma empresa ativa (vinda da claim do Firebase).
 */
export function hasKontalAccess(user: SessionUser): boolean {
    if (user.isPlatformUser) return canAccessKontal(user.platformRole);
    return user.memberships.some(membership => membership.isActive);
}
