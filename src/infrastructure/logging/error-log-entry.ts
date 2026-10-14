import type { ApiErrorLogInput } from '@/infrastructure/logging/error-log.types.js';
import { withoutUndefined } from '@/utils/without-undefined.js';

const MAX_MESSAGE = 2000;
const MAX_STACK = 8000;

/** Monta a entrada gravada em `logs/{correlationId}/entries`, sem campos `undefined`. */
export function buildErrorLogEntry(
    input: ApiErrorLogInput,
    companyName: string | undefined,
    now: Date,
): Record<string, unknown> {
    const timestamp = now.toISOString();
    return withoutUndefined({
        level: 'error',
        source: 'api',
        module: 'api-kontal',
        message: input.message.slice(0, MAX_MESSAGE),
        stack: input.stack?.slice(0, MAX_STACK),
        code: input.code,
        correlationId: input.correlationId,
        tenantId: input.companyId,
        tenantName: companyName,
        userUid: input.userUid,
        context: withoutUndefined({
            method: input.method,
            route: input.route,
            url: input.path,
            status: input.status,
        }),
        timestamp,
        savedAt: timestamp,
    });
}
