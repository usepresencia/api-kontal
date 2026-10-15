import { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformAdminGuard } from '@/infrastructure/auth/platform-admin.guard.js';
import { makeContext } from '@test/support/execution-context.js';

const guard = new PlatformAdminGuard();
const platformUser = (platformRole: PlatformRole) => ({
    userId: 'u1',
    isPlatformUser: true,
    platformRole,
});

describe('PlatformAdminGuard', () => {
    it('libera INTERNAL_ADMIN', () => {
        const { ctx } = makeContext({ user: platformUser(PlatformRole.INTERNAL_ADMIN) });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it.each([PlatformRole.INTERNAL_BILLING, PlatformRole.INTERNAL_SUPPORT, PlatformRole.COPYWRITE])(
        '403 FORBIDDEN para %s',
        role => {
            const { ctx } = makeContext({ user: platformUser(role) });
            expect(() => guard.canActivate(ctx)).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' }),
            );
        },
    );

    it('403 FORBIDDEN para usuário que não é de plataforma', () => {
        const { ctx } = makeContext({ user: { userId: 'u1', isPlatformUser: false } });
        expect(() => guard.canActivate(ctx)).toThrow(
            expect.objectContaining({ code: 'FORBIDDEN' }),
        );
    });

    it('401 UNAUTHORIZED sem usuário na requisição', () => {
        expect(() => guard.canActivate(makeContext().ctx)).toThrow(
            expect.objectContaining({ code: 'UNAUTHORIZED' }),
        );
    });
});
