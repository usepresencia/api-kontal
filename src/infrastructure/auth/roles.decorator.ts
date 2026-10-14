import { CustomDecorator, SetMetadata } from '@nestjs/common';
import type { MembershipRole } from '@/domain/auth/membership-role.js';

export const ROLES_KEY = 'roles';

/** Define os papéis de empresa aceitos na rota, ex.: `@Roles(...WRITE_ROLES)`. */
export const Roles = (...roles: MembershipRole[]): CustomDecorator<string> =>
    SetMetadata(ROLES_KEY, roles);
