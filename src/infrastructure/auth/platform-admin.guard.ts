import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { PlatformRole } from '@/domain/auth/platform-role.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

/** Permite somente o platform user com papel `INTERNAL_ADMIN`. */
@Injectable()
export class PlatformAdminGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
        if (!user) {
            throw new CodedHttpException(401, ErrorCode.UNAUTHORIZED, 'Usuário não autenticado');
        }
        if (!user.isPlatformUser || user.platformRole !== PlatformRole.INTERNAL_ADMIN) {
            throw new CodedHttpException(
                403,
                ErrorCode.FORBIDDEN,
                'Apenas administradores da plataforma podem executar esta operação',
            );
        }
        return true;
    }
}
