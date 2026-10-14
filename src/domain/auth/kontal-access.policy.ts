import { PlatformRole } from '@/domain/auth/platform-role.js';

/** Papéis de plataforma com acesso ao Kontal. */
export const KONTAL_PLATFORM_ROLES: readonly PlatformRole[] = [
    PlatformRole.INTERNAL_ADMIN,
    PlatformRole.INTERNAL_BILLING,
];

export function canAccessKontal(role: PlatformRole): boolean {
    return KONTAL_PLATFORM_ROLES.includes(role);
}
