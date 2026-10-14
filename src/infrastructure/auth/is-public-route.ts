import type { ExecutionContext } from '@nestjs/common';
import type { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '@/infrastructure/auth/public.decorator.js';

/** Indica se a rota ou o controller estão marcados com `@Public()`. */
export function isPublicRoute(reflector: Reflector, context: ExecutionContext): boolean {
    return (
        reflector.getAllAndOverride<boolean | undefined>(IS_PUBLIC_KEY, [
            context.getHandler(),
            context.getClass(),
        ]) === true
    );
}
