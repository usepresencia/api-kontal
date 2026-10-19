import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';
import { readCompanyId } from '@/infrastructure/auth/tenant-id.reader.js';
import { TenantRoleResolver } from '@/infrastructure/auth/tenant-role.resolver.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

/** Resolve a empresa e o papel efetivo da requisição e popula `request.tenantCtx`. */
@Injectable()
export class TenantIsolationGuard implements CanActivate {
    constructor(private readonly tenantRoles: TenantRoleResolver) {}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
        const user = request.user;
        if (!user) {
            throw new CodedHttpException(401, ErrorCode.UNAUTHORIZED, 'Usuário não autenticado');
        }

        const companyId = readCompanyId(request);
        if (!companyId) {
            throw new CodedHttpException(
                403,
                ErrorCode.TENANT_REQUIRED,
                'Contexto de empresa obrigatório (X-Tenant-Id)',
            );
        }

        request.tenantCtx = {
            companyId,
            membershipRole: await this.tenantRoles.resolve(user, companyId),
            userId: user.userId,
            platformRole: user.platformRole ?? null,
        };
        return true;
    }
}
