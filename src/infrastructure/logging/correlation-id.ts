import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';

export const CORRELATION_HEADER = 'x-correlation-id';

const SAFE_ID = /^[A-Za-z0-9_-]{8,128}$/;

/** Devolve o id recebido quando é seguro; caso contrário, gera um UUID. */
export function resolveCorrelationId(incoming: unknown): string {
    const value = Array.isArray(incoming) ? incoming[0] : incoming;
    return typeof value === 'string' && SAFE_ID.test(value) ? value : randomUUID();
}

/** Garante o correlation id na requisição e na resposta. */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
    const id = resolveCorrelationId(req.headers[CORRELATION_HEADER]);
    req.headers[CORRELATION_HEADER] = id;
    res.setHeader(CORRELATION_HEADER, id);
    next();
}

/** Lê o correlation id da resposta ou, na falta, resolve a partir da requisição. */
export function readCorrelationId(request: Request, response: Response): string {
    const fromResponse = response.getHeader(CORRELATION_HEADER);
    return typeof fromResponse === 'string'
        ? fromResponse
        : resolveCorrelationId(request.headers[CORRELATION_HEADER]);
}
