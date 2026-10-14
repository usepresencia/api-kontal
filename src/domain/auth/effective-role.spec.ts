import { effectiveRoleForPlatform } from '@/domain/auth/effective-role.js';
import { MembershipRole } from '@/domain/auth/membership-role.js';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import { DomainError } from '@/domain/errors/domain-error.js';

describe('effectiveRoleForPlatform', () => {
    it('INTERNAL_ADMIN assume OWNER', () => {
        expect(effectiveRoleForPlatform(PlatformRole.INTERNAL_ADMIN)).toBe(MembershipRole.OWNER);
    });

    it('INTERNAL_BILLING assume SUPPORT', () => {
        expect(effectiveRoleForPlatform(PlatformRole.INTERNAL_BILLING)).toBe(
            MembershipRole.SUPPORT,
        );
    });

    it.each([PlatformRole.INTERNAL_SUPPORT, PlatformRole.COPYWRITE])(
        '%s é recusado com DomainError FORBIDDEN',
        role => {
            expect(() => effectiveRoleForPlatform(role)).toThrow(DomainError);
            expect(() => effectiveRoleForPlatform(role)).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' }),
            );
        },
    );
});
