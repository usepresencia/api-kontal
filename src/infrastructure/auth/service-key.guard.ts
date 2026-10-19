import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Env } from '@/config/env.schema.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

const HEADER = 'x-service-key';

const digest = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Autentica chamadas de outros sistemas pela chave de serviço em `X-Service-Key`. */
@Injectable()
export class ServiceKeyGuard implements CanActivate {
    constructor(private readonly config: ConfigService<Env, true>) {}

    canActivate(context: ExecutionContext): boolean {
        const expected = this.config.get('PROVISIONING_API_KEY', { infer: true });
        if (!expected) {
            throw new CodedHttpException(
                503,
                ErrorCode.PROVISIONING_DISABLED,
                'Provisionamento desativado neste ambiente',
            );
        }

        const request = context.switchToHttp().getRequest<{ headers: Record<string, unknown> }>();
        const received = request.headers[HEADER];
        if (typeof received !== 'string' || !timingSafeEqual(digest(received), digest(expected))) {
            throw new CodedHttpException(401, ErrorCode.UNAUTHORIZED, 'Chave de serviço inválida');
        }
        return true;
    }
}
