import { PlatformRole } from '@/domain/auth/platform-role.js';
import { KontalAccessGuard } from '@/infrastructure/auth/kontal-access.guard.js';
import { fakeReflector, makeContext } from '@test/support/execution-context.js';

const platformUser = (platformRole: PlatformRole) => ({
    userId: 'u1',
    isPlatformUser: true,
    platformRole,
});

describe('KontalAccessGuard', () => {
    const guard = new KontalAccessGuard(fakeReflector());

    it('libera rotas @Public()', () => {
        const publicGuard = new KontalAccessGuard(fakeReflector({ isPublic: true }));
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

    const member = (isActive: boolean) => ({
        userId: 'u1',
        isPlatformUser: false,
        memberships: [
            { companyId: 'c1', role: 'OWNER', isActive, company: { id: 'c1', name: 'Empresa' } },
        ],
    });

    it('libera usuário comum com empresa ativa', () => {
        const { ctx } = makeContext({ user: member(true) });
        expect(guard.canActivate(ctx)).toBe(true);
    });

    it('403 FORBIDDEN para usuário comum sem empresa ativa (cliente da Presencia)', () => {
        for (const user of [member(false), { ...member(true), memberships: [] }]) {
            const { ctx } = makeContext({ user });
            expect(() => guard.canActivate(ctx)).toThrow(
                expect.objectContaining({ code: 'FORBIDDEN' }),
            );
        }
    });

    it('401 UNAUTHORIZED quando não há usuário na requisição', () => {
        expect(() => guard.canActivate(makeContext().ctx)).toThrow(
            expect.objectContaining({ code: 'UNAUTHORIZED' }),
        );
    });
});
