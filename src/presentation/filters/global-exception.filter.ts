import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { ErrorCode } from '@/domain/errors/error-codes.js';
import { readCorrelationId } from '@/infrastructure/logging/correlation-id.js';
import type { ErrorLogSink } from '@/infrastructure/logging/error-log.types.js';
import { serializeError } from '@/infrastructure/logging/safe-error.serializer.js';
import { buildClientErrorBody } from '@/presentation/errors/client-error-body.js';
import { buildErrorLogInput } from '@/presentation/errors/error-log-input.builder.js';
import { classifyException } from '@/presentation/errors/exception-classifier.js';

/** Converte qualquer exceção em resposta JSON com `code` e `correlationId`. */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    private readonly logger = new Logger(GlobalExceptionFilter.name);

    constructor(private readonly errorLog?: ErrorLogSink) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const http = host.switchToHttp();
        const response = http.getResponse<Response>();
        const request = http.getRequest<Request>();

        const correlationId = readCorrelationId(request, response);
        const { status, code } = classifyException(exception);
        const logMsg = `[${request.method}] ${request.url} → ${status} (${correlationId})`;

        if (status >= 500) {
            this.respondServerError(
                exception,
                request,
                response,
                status,
                code,
                correlationId,
                logMsg,
            );
            return;
        }
        this.respondClientError(exception, response, status, code, correlationId, logMsg);
    }

    private respondServerError(
        exception: unknown,
        request: Request,
        response: Response,
        status: number,
        code: ErrorCode,
        correlationId: string,
        logMsg: string,
    ): void {
        const safe = serializeError(exception);
        this.logger.error(`${logMsg} - ${safe.message}`, safe.stack);
        void this.errorLog?.write(
            buildErrorLogInput(exception, request, status, code, correlationId),
        );
        response.status(status).json({
            statusCode: status,
            message: 'Erro interno no servidor',
            error: 'Internal Server Error',
            code,
            correlationId,
        });
    }

    private respondClientError(
        exception: unknown,
        response: Response,
        status: number,
        code: ErrorCode,
        correlationId: string,
        logMsg: string,
    ): void {
        const body = buildClientErrorBody(exception, status, code);
        this.logger.warn(`${logMsg} - ${JSON.stringify(body)}`);
        response.status(status).json({ ...body, code, correlationId });
    }
}
