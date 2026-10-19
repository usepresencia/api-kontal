import { MembershipRole } from '@/domain/auth/membership-role.js';

export const Permission = {
    READ: 'READ',
    EXPORT: 'EXPORT',
    WRITE_REGISTRY: 'WRITE_REGISTRY',
    WRITE_FINANCIAL: 'WRITE_FINANCIAL',
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const GRANTS: Record<MembershipRole, readonly Permission[]> = {
    OWNER: [
        Permission.READ,
        Permission.EXPORT,
        Permission.WRITE_REGISTRY,
        Permission.WRITE_FINANCIAL,
    ],
    OPERATIONAL: [
        Permission.READ,
        Permission.EXPORT,
        Permission.WRITE_REGISTRY,
        Permission.WRITE_FINANCIAL,
    ],
    ACCOUNTANT: [Permission.READ, Permission.EXPORT],
    SUPPORT: [Permission.READ, Permission.EXPORT],
};

/** Indica se o papel possui a permissão. */
export function can(role: MembershipRole, permission: Permission): boolean {
    return GRANTS[role].includes(permission);
}

const allRoles = Object.values(MembershipRole);

export const READ_ROLES: readonly MembershipRole[] = allRoles.filter(r => can(r, Permission.READ));

export const EXPORT_ROLES: readonly MembershipRole[] = allRoles.filter(r =>
    can(r, Permission.EXPORT),
);

/** Papéis que escrevem em cadastros e no financeiro. */
export const WRITE_ROLES: readonly MembershipRole[] = allRoles.filter(
    r => can(r, Permission.WRITE_REGISTRY) && can(r, Permission.WRITE_FINANCIAL),
);
