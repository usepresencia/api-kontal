import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode } from '@/domain/errors/error-codes.js';
import { CodedHttpException } from '@/presentation/errors/coded-http.exception.js';
import { classifyException } from '@/presentation/errors/exception-classifier.js';

describe('classifyException', () => {
    it('DomainError usa o status do código', () => {
        expect(classifyException(new DomainError(ErrorCode.COMPANY_NOT_FOUND, 'x'))).toEqual({
            status: 404,
            code: 'COMPANY_NOT_FOUND',
        });
    });

    it('CodedHttpException mantém status e código próprios', () => {
        expect(
            classifyException(new CodedHttpException(403, ErrorCode.TENANT_REQUIRED, 'x')),
        ).toEqual({ status: 403, code: 'TENANT_REQUIRED' });
    });

    it.each([
        [new BadRequestException(), 400, 'VALIDATION_ERROR'],
        [new NotFoundException(), 404, 'NOT_FOUND'],
    ])('HttpException comum usa o código padrão do status', (exception, status, code) => {
        expect(classifyException(exception)).toEqual({ status, code });
    });

    it.each([[new Error('x')], ['texto'], [undefined]])(
        'qualquer outro valor vira 500 INTERNAL_ERROR',
        exception => {
            expect(classifyException(exception)).toEqual({
                status: 500,
                code: 'INTERNAL_ERROR',
            });
        },
    );
});
