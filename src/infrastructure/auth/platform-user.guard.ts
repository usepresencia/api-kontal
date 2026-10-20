import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

/** Permite somente platform users (rotas de administração entre empresas). */
@Injectable()
export class PlatformUserGuard implements CanActivate {
    canActivate(context: ExecutionContext): boolean {
        const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
        if (!user) {
            throw new CodedHttpException(401, ErrorCode.UNAUTHORIZED, 'Usuário não autenticado');
        }
        if (!user.isPlatformUser) {
            throw new CodedHttpException(
                403,
                ErrorCode.FORBIDDEN,
                'Apenas a equipe da plataforma pode executar esta operação',
            );
        }
        return true;
    }
}
