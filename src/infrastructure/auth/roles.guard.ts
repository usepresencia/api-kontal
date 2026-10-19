import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { MembershipRole } from '@/domain/auth/membership-role.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';
import { ROLES_KEY } from '@/infrastructure/auth/roles.decorator.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

/** Exige que o papel em `request.tenantCtx` esteja em `@Roles`; roda depois do `TenantIsolationGuard`. */
@Injectable()
export class RolesGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        const roles = this.reflector.getAllAndOverride<MembershipRole[] | undefined>(ROLES_KEY, [
            context.getHandler(),
            context.getClass(),
        ]);
        if (!roles?.length) return true;

        const tenantCtx = context.switchToHttp().getRequest<AuthenticatedRequest>().tenantCtx;
        if (!tenantCtx) {
            throw new CodedHttpException(
                403,
                ErrorCode.TENANT_REQUIRED,
                'Contexto de empresa obrigatório (X-Tenant-Id)',
            );
        }
        if (!roles.includes(tenantCtx.membershipRole)) {
            throw new CodedHttpException(
                403,
                ErrorCode.FORBIDDEN,
                'Seu papel não permite esta operação',
            );
        }
        return true;
    }
}
