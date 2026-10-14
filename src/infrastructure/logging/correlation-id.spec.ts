import type { NextFunction, Request, Response } from 'express';
import {
    CORRELATION_HEADER,
    correlationIdMiddleware,
    readCorrelationId,
    resolveCorrelationId,
} from '@/infrastructure/logging/correlation-id.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('resolveCorrelationId', () => {
    it('reaproveita um id seguro', () => {
        expect(resolveCorrelationId('abc12345_-XYZ')).toBe('abc12345_-XYZ');
    });

    it.each([
        ['curto demais', 'abc'],
        ['longo demais', 'a'.repeat(129)],
        ['caracteres inválidos', 'abc/../12345678'],
        ['com espaço', 'abc 12345678'],
        ['injeção de header', 'abc12345\r\nX-Evil: 1'],
        ['ausente', undefined],
        ['não-string', 12345678],
    ])('substitui por UUID quando %s', (_label, input) => {
        expect(resolveCorrelationId(input)).toMatch(UUID);
    });

    it('usa o primeiro valor quando o header chega como array', () => {
        expect(resolveCorrelationId(['abc12345', 'outro-valor-1'])).toBe('abc12345');
    });

    it('substitui quando o primeiro item do array é inseguro', () => {
        expect(resolveCorrelationId(['x', 'abc12345'])).toMatch(UUID);
    });
});

describe('correlationIdMiddleware', () => {
    it('grava o id na requisição e na resposta e segue a cadeia', () => {
        const req = { headers: { [CORRELATION_HEADER]: 'abc12345' } } as unknown as Request;
        const res = { setHeader: vi.fn() } as unknown as Response;
        const next = vi.fn() as NextFunction;
        correlationIdMiddleware(req, res, next);
        expect(req.headers[CORRELATION_HEADER]).toBe('abc12345');
        expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_HEADER, 'abc12345');
        expect(next).toHaveBeenCalledOnce();
    });

    it('gera um id quando a requisição não traz', () => {
        const req = { headers: {} } as unknown as Request;
        const res = { setHeader: vi.fn() } as unknown as Response;
        correlationIdMiddleware(req, res, vi.fn() as NextFunction);
        expect(req.headers[CORRELATION_HEADER]).toMatch(UUID);
    });
});

describe('readCorrelationId', () => {
    const request = { headers: { [CORRELATION_HEADER]: 'abc12345' } } as unknown as Request;

    it('prefere o id já definido na resposta', () => {
        const response = { getHeader: () => 'from-response-1' } as unknown as Response;
        expect(readCorrelationId(request, response)).toBe('from-response-1');
    });

    it('resolve pela requisição quando a resposta não tem o header', () => {
        const response = { getHeader: () => undefined } as unknown as Response;
        expect(readCorrelationId(request, response)).toBe('abc12345');
    });
});
