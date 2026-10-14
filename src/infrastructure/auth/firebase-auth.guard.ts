import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { isPublicRoute } from '@/infrastructure/auth/is-public-route.js';

/** Exige o Firebase ID token em toda rota que não seja `@Public()`. */
@Injectable()
export class FirebaseAuthGuard extends AuthGuard('firebase') {
    constructor(private readonly reflector: Reflector) {
        super();
    }

    canActivate(context: ExecutionContext) {
        if (isPublicRoute(this.reflector, context)) return true;
        return super.canActivate(context);
    }
}
