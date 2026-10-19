import { MembershipRole } from '@/domain/auth/membership-role.js';
import {
    EXPORT_ROLES,
    Permission,
    READ_ROLES,
    WRITE_ROLES,
    can,
} from '@/domain/auth/permissions.js';

const { OWNER, OPERATIONAL, ACCOUNTANT, SUPPORT } = MembershipRole;

describe('matriz de permissões', () => {
    it.each([
        [OWNER, Permission.READ, true],
        [OWNER, Permission.EXPORT, true],
        [OWNER, Permission.WRITE_REGISTRY, true],
        [OWNER, Permission.WRITE_FINANCIAL, true],
        [OPERATIONAL, Permission.READ, true],
        [OPERATIONAL, Permission.EXPORT, true],
        [OPERATIONAL, Permission.WRITE_REGISTRY, true],
        [OPERATIONAL, Permission.WRITE_FINANCIAL, true],
        [ACCOUNTANT, Permission.READ, true],
        [ACCOUNTANT, Permission.EXPORT, true],
        [ACCOUNTANT, Permission.WRITE_REGISTRY, false],
        [ACCOUNTANT, Permission.WRITE_FINANCIAL, false],
        [SUPPORT, Permission.READ, true],
        [SUPPORT, Permission.EXPORT, true],
        [SUPPORT, Permission.WRITE_REGISTRY, false],
        [SUPPORT, Permission.WRITE_FINANCIAL, false],
    ])('%s × %s → %s', (role, permission, expected) => {
        expect(can(role, permission)).toBe(expected);
    });
});

describe('listas de papéis', () => {
    it('READ_ROLES e EXPORT_ROLES incluem todos os papéis', () => {
        expect([...READ_ROLES].sort()).toEqual([ACCOUNTANT, OPERATIONAL, OWNER, SUPPORT].sort());
        expect([...EXPORT_ROLES].sort()).toEqual([ACCOUNTANT, OPERATIONAL, OWNER, SUPPORT].sort());
    });

    it('WRITE_ROLES é só OWNER e OPERATIONAL', () => {
        expect([...WRITE_ROLES].sort()).toEqual([OPERATIONAL, OWNER].sort());
    });
});
