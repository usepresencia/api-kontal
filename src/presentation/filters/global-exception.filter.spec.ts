import { type ArgumentsHost, BadRequestException } from '@nestjs/common';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';
import { GlobalExceptionFilter } from '@/presentation/filters/global-exception.filter.js';

function makeHost(request: Record<string, unknown> = {}) {
    const response = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn(),
        getHeader: vi.fn().mockReturnValue(undefined),
    };
    const req = {
        method: 'GET',
        url: '/api/v1/x',
        path: '/api/v1/x',
        headers: { 'x-correlation-id': 'corr-12345678' },
        ...request,
    };
    const host = {
        switchToHttp: () => ({ getResponse: () => response, getRequest: () => req }),
    } as unknown as ArgumentsHost;
    return { host, response };
}

describe('GlobalExceptionFilter', () => {
    it('DomainError vira 4xx com code estável, mensagem e correlationId', () => {
        const { host, response } = makeHost();
        new GlobalExceptionFilter().catch(
            new DomainError(ErrorCode.COMPANY_NOT_FOUND, 'Empresa não encontrada'),
            host,
        );
        expect(response.status).toHaveBeenCalledWith(404);
        expect(response.json).toHaveBeenCalledWith({
            statusCode: 404,
            message: 'Empresa não encontrada',
            error: 'COMPANY_NOT_FOUND',
            code: 'COMPANY_NOT_FOUND',
            correlationId: 'corr-12345678',
        });
    });

    it('CodedHttpException mantém status e código próprios', () => {
        const { host, response } = makeHost();
        new GlobalExceptionFilter().catch(
            new CodedHttpException(403, ErrorCode.TENANT_REQUIRED, 'Contexto obrigatório'),
            host,
        );
        expect(response.status).toHaveBeenCalledWith(403);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({ code: 'TENANT_REQUIRED', correlationId: 'corr-12345678' }),
        );
    });

    it('HttpException comum preserva o corpo e usa o código padrão do status', () => {
        const { host, response } = makeHost();
        new GlobalExceptionFilter().catch(
            new BadRequestException({ message: 'Validation failed', errors: { a: ['x'] } }),
            host,
        );
        expect(response.status).toHaveBeenCalledWith(400);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({
                message: 'Validation failed',
                errors: { a: ['x'] },
                code: 'VALIDATION_ERROR',
            }),
        );
    });

    it('erro não tratado vira 500 genérico, sem vazar a mensagem, e vai para o log', () => {
        const errorLog = { write: vi.fn().mockResolvedValue(undefined) };
        const { host, response } = makeHost({
            headers: { 'x-correlation-id': 'corr-12345678', 'x-tenant-id': 'c1' },
        });
        new GlobalExceptionFilter(errorLog).catch(new Error('segredo interno'), host);
        expect(response.status).toHaveBeenCalledWith(500);
        const body = response.json.mock.calls[0][0];
        expect(body).toEqual({
            statusCode: 500,
            message: 'Erro interno no servidor',
            error: 'Internal Server Error',
            code: 'INTERNAL_ERROR',
            correlationId: 'corr-12345678',
        });
        expect(JSON.stringify(body)).not.toContain('segredo interno');
        expect(errorLog.write).toHaveBeenCalledWith(
            expect.objectContaining({
                correlationId: 'corr-12345678',
                status: 500,
                companyId: 'c1',
            }),
        );
    });

    it('funciona sem sink de log', () => {
        const { host, response } = makeHost();
        new GlobalExceptionFilter().catch('texto solto', host);
        expect(response.status).toHaveBeenCalledWith(500);
    });

    it('usa o correlationId já presente na resposta', () => {
        const { host, response } = makeHost();
        response.getHeader.mockReturnValue('from-response-1');
        new GlobalExceptionFilter().catch(new DomainError(ErrorCode.CONFLICT, 'x'), host);
        expect(response.json).toHaveBeenCalledWith(
            expect.objectContaining({ correlationId: 'from-response-1' }),
        );
    });
});
