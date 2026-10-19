import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { buildClientErrorBody } from '@/presentation/errors/client-error-body.js';

describe('buildClientErrorBody', () => {
    it('DomainError vira statusCode, message e error', () => {
        const body = buildClientErrorBody(
            new DomainError(ErrorCode.CONFLICT, 'já existe'),
            409,
            ErrorCode.CONFLICT,
        );
        expect(body).toEqual({ statusCode: 409, message: 'já existe', error: 'CONFLICT' });
    });

    it('HttpException preserva o corpo original', () => {
        const exception = new BadRequestException({
            message: 'Validation failed',
            errors: { a: ['x'] },
        });
        expect(buildClientErrorBody(exception, 400, ErrorCode.VALIDATION_ERROR)).toEqual({
            message: 'Validation failed',
            errors: { a: ['x'] },
        });
    });

    it('HttpException com corpo string vira objeto', () => {
        const exception = new NotFoundException();
        vi.spyOn(exception, 'getResponse').mockReturnValue('não achei');
        expect(buildClientErrorBody(exception, 404, ErrorCode.NOT_FOUND)).toEqual({
            statusCode: 404,
            message: 'não achei',
        });
    });
});
