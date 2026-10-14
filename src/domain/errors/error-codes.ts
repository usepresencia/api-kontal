/** Códigos de erro devolvidos no campo `code` das respostas da API. */
export const ErrorCode = {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    HTTP_ERROR: 'HTTP_ERROR',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
    TENANT_REQUIRED: 'TENANT_REQUIRED',
    COMPANY_NOT_FOUND: 'COMPANY_NOT_FOUND',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

const STATUS_BY_CODE: Record<ErrorCode, number> = {
    VALIDATION_ERROR: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    HTTP_ERROR: 500,
    INTERNAL_ERROR: 500,
    TENANT_REQUIRED: 403,
    COMPANY_NOT_FOUND: 404,
};

/** Status HTTP correspondente a um código de erro. */
export function statusForCode(code: ErrorCode): number {
    return STATUS_BY_CODE[code];
}

/** Código de erro correspondente a um status HTTP. */
export function defaultErrorCode(status: number): ErrorCode {
    if (status >= 500) return ErrorCode.INTERNAL_ERROR;
    switch (status) {
        case 400:
            return ErrorCode.VALIDATION_ERROR;
        case 401:
            return ErrorCode.UNAUTHORIZED;
        case 403:
            return ErrorCode.FORBIDDEN;
        case 404:
            return ErrorCode.NOT_FOUND;
        case 409:
            return ErrorCode.CONFLICT;
        default:
            return ErrorCode.HTTP_ERROR;
    }
}
