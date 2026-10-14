import { HttpException } from '@nestjs/common';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode, defaultErrorCode, statusForCode } from '@/domain/errors/error-codes.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';

/** Determina o status HTTP e o código de erro de qualquer valor lançado. */
export function classifyException(exception: unknown): { status: number; code: ErrorCode } {
    if (exception instanceof DomainError) {
        return { status: statusForCode(exception.code), code: exception.code };
    }
    if (exception instanceof CodedHttpException) {
        return { status: exception.getStatus(), code: exception.code };
    }
    if (exception instanceof HttpException) {
        const status = exception.getStatus();
        return { status, code: defaultErrorCode(status) };
    }
    return { status: 500, code: ErrorCode.INTERNAL_ERROR };
}
