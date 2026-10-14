import { MembershipRole } from '@/domain/auth/membership-role.js';
import { WRITE_ROLES } from '@/domain/auth/permissions.js';
import { RolesGuard } from '@/infrastructure/auth/roles.guard.js';
import { fakeReflector, makeContext } from '@test/support/execution-context.js';

const ctxWithRole = (membershipRole: MembershipRole) =>
    makeContext({ tenantCtx: { companyId: 'c1', membershipRole } }).ctx;

describe('RolesGuard', () => {
    const guard = new RolesGuard(fakeReflector({ roles: [...WRITE_ROLES] }));

    it.each([MembershipRole.OWNER, MembershipRole.OPERATIONAL])('libera %s', role => {
        expect(guard.canActivate(ctxWithRole(role))).toBe(true);
    });

    it.each([MembershipRole.ACCOUNTANT, MembershipRole.SUPPORT])('403 FORBIDDEN para %s', role => {
        expect(() => guard.canActivate(ctxWithRole(role))).toThrow(
            expect.objectContaining({ code: 'FORBIDDEN' }),
        );
    });

    it('403 TENANT_REQUIRED quando o TenantIsolationGuard não rodou', () => {
        expect(() => guard.canActivate(makeContext().ctx)).toThrow(
            expect.objectContaining({ code: 'TENANT_REQUIRED' }),
        );
    });

    it('libera quando a rota não declara @Roles', () => {
        const open = new RolesGuard(fakeReflector());
        expect(open.canActivate(makeContext().ctx)).toBe(true);
    });

    it('libera quando @Roles está vazio', () => {
        const open = new RolesGuard(fakeReflector({ roles: [] }));
        expect(open.canActivate(makeContext().ctx)).toBe(true);
    });
});
