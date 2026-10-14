import { DomainError } from '@/domain/errors/domain-error.js';
import { ErrorCode, defaultErrorCode, statusForCode } from '@/domain/errors/error-codes.js';

describe('statusForCode', () => {
    it.each([
        [ErrorCode.VALIDATION_ERROR, 400],
        [ErrorCode.UNAUTHORIZED, 401],
        [ErrorCode.FORBIDDEN, 403],
        [ErrorCode.TENANT_REQUIRED, 403],
        [ErrorCode.NOT_FOUND, 404],
        [ErrorCode.COMPANY_NOT_FOUND, 404],
        [ErrorCode.CONFLICT, 409],
        [ErrorCode.HTTP_ERROR, 500],
        [ErrorCode.INTERNAL_ERROR, 500],
    ])('%s → %i', (code, status) => {
        expect(statusForCode(code)).toBe(status);
    });
});

describe('defaultErrorCode', () => {
    it.each([
        [400, ErrorCode.VALIDATION_ERROR],
        [401, ErrorCode.UNAUTHORIZED],
        [403, ErrorCode.FORBIDDEN],
        [404, ErrorCode.NOT_FOUND],
        [409, ErrorCode.CONFLICT],
        [418, ErrorCode.HTTP_ERROR],
        [500, ErrorCode.INTERNAL_ERROR],
        [503, ErrorCode.INTERNAL_ERROR],
    ])('status %i → %s', (status, code) => {
        expect(defaultErrorCode(status)).toBe(code);
    });
});

describe('DomainError', () => {
    it('carrega code e message e é um Error', () => {
        const err = new DomainError(ErrorCode.CONFLICT, 'já existe');
        expect(err).toBeInstanceOf(Error);
        expect(err.code).toBe('CONFLICT');
        expect(err.message).toBe('já existe');
        expect(err.name).toBe('DomainError');
    });
});
