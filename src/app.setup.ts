import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { buildCorsOptions, parseCorsOrigins } from '@/config/cors.config.js';
import type { Env } from '@/config/env.schema.js';
import { correlationIdMiddleware } from '@/infrastructure/logging/correlation-id.js';
import { ErrorLogWriter } from '@/infrastructure/logging/error-log.writer.js';
import { GlobalExceptionFilter } from '@/presentation/filters/global-exception.filter.js';

/** Aplica middleware de correlação, prefixo `api/v1`, CORS e filtro global. */
export function configureApp(app: NestExpressApplication): void {
    const config = app.get<ConfigService<Env, true>>(ConfigService);

    app.use(correlationIdMiddleware);
    app.setGlobalPrefix('api/v1');
    app.enableCors(
        buildCorsOptions(parseCorsOrigins(config.get('CORS_ALLOWED_ORIGINS', { infer: true }))),
    );
    app.useGlobalFilters(new GlobalExceptionFilter(app.get(ErrorLogWriter)));
}
