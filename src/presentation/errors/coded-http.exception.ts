import { HttpException } from '@nestjs/common';
import type { ErrorCode } from '@/domain/errors/error-codes.js';

/** HttpException com código de erro estável. */
export class CodedHttpException extends HttpException {
    constructor(
        status: number,
        readonly code: ErrorCode,
        message: string,
    ) {
        super({ statusCode: status, message, error: code }, status);
    }
}
