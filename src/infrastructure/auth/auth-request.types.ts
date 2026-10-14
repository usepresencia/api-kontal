import type { Request } from 'express';
import type { SessionUser } from '@/domain/auth/session-user.js';
import type { ResolvedTenantCtx } from '@/domain/auth/tenant-context.js';

/** Requisição Express com `user` (auth) e `tenantCtx` (empresa) preenchidos pelos guards. */
export type AuthenticatedRequest = Request & {
    user?: SessionUser;
    tenantCtx?: ResolvedTenantCtx;
};
