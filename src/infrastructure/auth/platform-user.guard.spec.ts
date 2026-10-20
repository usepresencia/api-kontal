import { PlatformRole } from '@/domain/auth/platform-role.js';
import { PlatformUserGuard } from '@/infrastructure/auth/platform-user.guard.js';
import { makeContext } from '@test/support/execution-context.js';

describe('PlatformUserGuard', () => {
    const guard = new PlatformUserGuard();

    it('libera platform user', () => {
        const { ctx } = makeContext({
            user: {
                userId: 'u1',
                isPlatformUser: true,
                platformRole: PlatformRole.INTERNAL_BILLING,
            },
        });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('403 FORBIDDEN para usuário de empresa (não é de plataforma)', () => {
        const { ctx } = makeContext({
            user: { userId: 'u1', isPlatformUser: false, memberships: [] },
        });
        expect(() => guard.canActivate(ctx)).toThrow(
            expect.objectContaining({ code: 'FORBIDDEN' }),
        );
    });

    it('401 UNAUTHORIZED sem usuário', () => {
        expect(() => guard.canActivate(makeContext().ctx)).toThrow(
            expect.objectContaining({ code: 'UNAUTHORIZED' }),
        );
    });
});
