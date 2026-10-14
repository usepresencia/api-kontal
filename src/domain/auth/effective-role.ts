import { MembershipRole } from '@/domain/auth/membership-role.js';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';

/**
 * Papel que um platform user assume dentro de qualquer empresa.
 * @throws DomainError FORBIDDEN para papéis sem acesso ao Kontal
 */
export function effectiveRoleForPlatform(role: PlatformRole): MembershipRole {
    switch (role) {
        case PlatformRole.INTERNAL_ADMIN:
            return MembershipRole.OWNER;
        case PlatformRole.INTERNAL_BILLING:
            return MembershipRole.SUPPORT;
        default:
            throw new DomainError(ErrorCode.FORBIDDEN, 'Papel de plataforma sem acesso ao Kontal');
    }
}
