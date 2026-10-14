import type { Request } from 'express';
import type { ErrorCode } from '@/domain/errors/error-codes.js';
import type { ApiErrorLogInput } from '@/infrastructure/logging/error-log.types.js';

/** Monta o registro de log de um erro 5xx a partir da exceção e da requisição. */
export function buildErrorLogInput(
    exception: unknown,
    request: Request,
    status: number,
    code: ErrorCode,
    correlationId: string,
): ApiErrorLogInput {
    const isError = exception instanceof Error;
    const headerTenant = request.headers['x-tenant-id'];
    const user = (request as Request & { user?: { firebaseUid?: string } }).user;
    return {
        correlationId,
        message: isError ? exception.message : String(exception),
        stack: isError ? exception.stack : undefined,
        code,
        status,
        method: request.method,
        route: (request.route as { path?: string } | undefined)?.path,
        path: request.path,
        companyId: typeof headerTenant === 'string' && headerTenant ? headerTenant : undefined,
        userUid: user?.firebaseUid,
    };
}
