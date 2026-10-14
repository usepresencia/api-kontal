import { MembershipRole } from '@/domain/auth/membership-role.js';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import type { TenantRoleResolver } from '@/infrastructure/auth/tenant-role.resolver.js';
import { TenantIsolationGuard } from '@/infrastructure/auth/tenant-isolation.guard.js';
import { makeContext } from '@test/support/execution-context.js';

const tenantRoles = { resolve: vi.fn() };
const guard = new TenantIsolationGuard(tenantRoles as unknown as TenantRoleResolver);

const platformUser = {
    userId: 'u1',
    isPlatformUser: true,
    platformRole: PlatformRole.INTERNAL_ADMIN,
};
const regularUser = { userId: 'u2', isPlatformUser: false };

beforeEach(() => {
    tenantRoles.resolve.mockReset().mockResolvedValue(MembershipRole.OWNER);
});

describe('TenantIsolationGuard', () => {
    it('401 UNAUTHORIZED sem usuário', async () => {
        const { ctx } = makeContext({ headers: { 'x-tenant-id': 'c1' } });
        await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    });

    it('403 TENANT_REQUIRED sem companyId, sem consultar o resolver', async () => {
        const { ctx } = makeContext({ user: platformUser });
        await expect(guard.canActivate(ctx)).rejects.toMatchObject({ code: 'TENANT_REQUIRED' });
        expect(tenantRoles.resolve).not.toHaveBeenCalled();
    });

    it('popula tenantCtx de um platform user, com o autor', async () => {
        const { ctx, req } = makeContext({
            user: platformUser,
            headers: { 'x-tenant-id': 'c1' },
        });
        await expect(guard.canActivate(ctx)).resolves.toBe(true);
        expect(tenantRoles.resolve).toHaveBeenCalledWith(platformUser, 'c1');
        expect(req.tenantCtx).toEqual({
            companyId: 'c1',
            membershipRole: MembershipRole.OWNER,
            userId: 'u1',
            platformRole: PlatformRole.INTERNAL_ADMIN,
        });
    });

    it('popula tenantCtx de um usuário comum com platformRole null', async () => {
        tenantRoles.resolve.mockResolvedValue(MembershipRole.ACCOUNTANT);
        const { ctx, req } = makeContext({ user: regularUser, query: { tenantId: 'c9' } });
        await guard.canActivate(ctx);
        expect(req.tenantCtx).toEqual({
            companyId: 'c9',
            membershipRole: MembershipRole.ACCOUNTANT,
            userId: 'u2',
            platformRole: null,
        });
    });

    it('propaga a recusa do resolver e não popula o tenantCtx', async () => {
        const denied = new Error('negado');
        tenantRoles.resolve.mockRejectedValue(denied);
        const { ctx, req } = makeContext({ user: regularUser, headers: { 'x-tenant-id': 'c1' } });
        await expect(guard.canActivate(ctx)).rejects.toBe(denied);
        expect(req.tenantCtx).toBeUndefined();
    });
});
