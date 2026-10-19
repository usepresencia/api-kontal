import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';

/** Lê o `companyId` do header `X-Tenant-Id` ou, na falta, do query param `tenantId`. */
export function readCompanyId(
    request: Pick<AuthenticatedRequest, 'headers' | 'query'>,
): string | undefined {
    const raw = request.headers['x-tenant-id'] || request.query?.tenantId;
    const value = typeof raw === 'string' ? raw.trim() : '';
    return value || undefined;
}
