import { PlatformRole } from '@/domain/auth/platform-role.js';
import type { SessionUser } from '@/domain/auth/session-user.js';
import {
    KONTAL_PLATFORM_ROLES,
    canAccessKontal,
    hasKontalAccess,
} from '@/domain/auth/kontal-access.policy.js';

describe('canAccessKontal', () => {
    it.each([
        [PlatformRole.INTERNAL_ADMIN, true],
        [PlatformRole.INTERNAL_BILLING, true],
        [PlatformRole.INTERNAL_SUPPORT, false],
        [PlatformRole.COPYWRITE, false],
    ])('%s → %s', (role, allowed) => {
        expect(canAccessKontal(role)).toBe(allowed);
    });

    it('lista exatamente ADMIN e BILLING', () => {
        expect([...KONTAL_PLATFORM_ROLES]).toEqual(['INTERNAL_ADMIN', 'INTERNAL_BILLING']);
    });
});

describe('hasKontalAccess', () => {
    const base = {
        userId: 'u1',
        firebaseUid: 'f1',
        email: 'a@kontal.com',
        name: 'A',
        avatarUrl: null,
        phone: null,
    };
    const membership = (isActive: boolean) => ({
        companyId: 'c1',
        role: 'OWNER' as const,
        isActive,
        company: { id: 'c1', name: 'Empresa' },
    });

    it('platform user: segue o papel', () => {
        const user = (platformRole: PlatformRole): SessionUser => ({
            ...base,
            memberships: [],
            isPlatformUser: true,
            platformRole,
        });
        expect(hasKontalAccess(user(PlatformRole.INTERNAL_ADMIN))).toBe(true);
        expect(hasKontalAccess(user(PlatformRole.INTERNAL_SUPPORT))).toBe(false);
    });

    it('usuário comum: exige uma empresa ativa', () => {
        const user = (memberships: ReturnType<typeof membership>[]): SessionUser => ({
            ...base,
            memberships,
            isPlatformUser: false,
        });
        expect(hasKontalAccess(user([membership(true)]))).toBe(true);
        expect(hasKontalAccess(user([membership(false)]))).toBe(false);
        expect(hasKontalAccess(user([]))).toBe(false);
    });
});
