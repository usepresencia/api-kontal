import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { SessionUser } from '@/domain/auth/session-user.js';
import type { AuthenticatedRequest } from '@/infrastructure/auth/auth-request.types.js';

/** Usuário autenticado da requisição. */
export const CurrentUser = createParamDecorator(
    (_data: unknown, ctx: ExecutionContext): SessionUser | undefined =>
        ctx.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
