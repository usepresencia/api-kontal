import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';

/** `companyId` da empresa resolvida; requer o `TenantIsolationGuard`. */
export const TenantId = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
    const tenantCtx = ctx.switchToHttp().getRequest<AuthenticatedRequest>().tenantCtx;
    return (tenantCtx as NonNullable<typeof tenantCtx>).companyId;
});
