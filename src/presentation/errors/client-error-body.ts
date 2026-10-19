import type { HttpException } from '@nestjs/common';
import { DomainError } from '@/domain/errors/domain-error.js';
import type { ErrorCode } from '@/domain/errors/error-codes.js';

/** Corpo devolvido ao cliente em erros 4xx. */
export function buildClientErrorBody(exception: unknown, status: number, code: ErrorCode): object {
    if (exception instanceof DomainError) {
        return { statusCode: status, message: exception.message, error: code };
    }
    const response = (exception as HttpException).getResponse();
    return typeof response === 'string' ? { statusCode: status, message: response } : response;
}
