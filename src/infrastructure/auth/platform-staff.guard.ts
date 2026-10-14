import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { canAccessKontal } from '@/domain/auth/kontal-access.policy.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';
import { isPublicRoute } from '@/infrastructure/auth/is-public-route.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

/** Permite somente platform users com papel liberado para o Kontal. */
@Injectable()
export class PlatformStaffGuard implements CanActivate {
    constructor(private readonly reflector: Reflector) {}

    canActivate(context: ExecutionContext): boolean {
        if (isPublicRoute(this.reflector, context)) return true;

        const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
        if (!user) {
            throw new CodedHttpException(401, ErrorCode.UNAUTHORIZED, 'Usuário não autenticado');
        }
        if (!user.isPlatformUser || !canAccessKontal(user.platformRole)) {
            throw new CodedHttpException(
                403,
                ErrorCode.FORBIDDEN,
                'Acesso restrito a este perfil da plataforma',
            );
        }
        return true;
    }
}
