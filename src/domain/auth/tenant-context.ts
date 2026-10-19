import type { MembershipRole } from '@/domain/auth/membership-role.js';
import type { PlatformRole } from '@/domain/auth/platform-role.js';

/** Contexto de empresa resolvido por requisição, colocado em `request.tenantCtx`. */
export interface ResolvedTenantCtx {
    companyId: string;
    membershipRole: MembershipRole;
    userId: string;
    platformRole: PlatformRole | null;
}
