import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { ResolvedTenantCtx } from '@/domain/auth/tenant-context.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';

/** Contexto de empresa resolvido; requer o `TenantIsolationGuard`. */
export const TenantContext = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): ResolvedTenantCtx =>
        ctx.switchToHttp().getRequest<AuthenticatedRequest>().tenantCtx as ResolvedTenantCtx,
);
