import { PlatformRole } from '@/domain/auth/platform-role.js';
import { KONTAL_PLATFORM_ROLES, canAccessKontal } from '@/domain/auth/kontal-access.policy.js';

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
