import { CORRELATION_HEADER } from '@/infrastructure/logging/correlation-id.js';

/** Converte a lista separada por vírgula de `CORS_ALLOWED_ORIGINS` em origens. */
export function parseCorsOrigins(raw: string | undefined): string[] {
    return (raw ?? '')
        .split(',')
        .map(origin => origin.trim())
        .filter(Boolean);
}

export function buildCorsOptions(origins: string[]) {
    return {
        origin: origins.length > 0 ? origins : false,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
        exposedHeaders: [CORRELATION_HEADER],
    };
}
