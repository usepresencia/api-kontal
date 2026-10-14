import { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformStaffGuard } from '@/infrastructure/auth/platform-staff.guard.js';
import { fakeReflector, makeContext } from '@test/support/execution-context.js';

const platformUser = (platformRole: PlatformRole) => ({
    userId: 'u1',
    isPlatformUser: true,
    platformRole,
});

describe('PlatformStaffGuard', () => {
    const guard = new PlatformStaffGuard(fakeReflector());

    it('libera rotas @Public()', () => {
        const publicGuard = new PlatformStaffGuard(fakeReflector({ isPublic: true }));
        expect(publicGuard.canActivate(makeContext().ctx)).toBe(true);
    });

    it.each([PlatformRole.INTERNAL_ADMIN, PlatformRole.INTERNAL_BILLING])('libera %s', role => {
        const { ctx } = makeContext({ user: platformUser(role) });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it.each([PlatformRole.INTERNAL_SUPPORT, PlatformRole.COPYWRITE])(
        '403 FORBIDDEN para %s',
        role => {
            const { ctx } = makeContext({ user: platformUser(role) });
            expect(() => guard.canActivate(ctx)).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' }),
            );
        },
    );

    it('403 FORBIDDEN para usuário que não é de plataforma (cliente da Presencia)', () => {
        const { ctx } = makeContext({ user: { userId: 'u1', isPlatformUser: false } });
        expect(() => guard.canActivate(ctx)).toThrow(
            expect.objectContaining({ code: 'FORBIDDEN' }),
        );
    });

    it('401 UNAUTHORIZED quando não há usuário na requisição', () => {
        expect(() => guard.canActivate(makeContext().ctx)).toThrow(
            expect.objectContaining({ code: 'UNAUTHORIZED' }),
        );
    });
});
