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
    BILLING_PLAN_NOT_FOUND: 'BILLING_PLAN_NOT_FOUND',
    BILLING_ACCOUNT_NOT_FOUND: 'BILLING_ACCOUNT_NOT_FOUND',
    ACCOUNT_PARENT_INVALID: 'ACCOUNT_PARENT_INVALID',
    ACCOUNT_PARENT_NOT_SYNTHETIC: 'ACCOUNT_PARENT_NOT_SYNTHETIC',
    ACCOUNT_ANALYTIC_REQUIRES_PARENT: 'ACCOUNT_ANALYTIC_REQUIRES_PARENT',
    ACCOUNT_MAX_DEPTH_EXCEEDED: 'ACCOUNT_MAX_DEPTH_EXCEEDED',
    ACCOUNT_HAS_CHILDREN: 'ACCOUNT_HAS_CHILDREN',
    PLAN_HAS_ACCOUNTS: 'PLAN_HAS_ACCOUNTS',
    CNPJ_ALREADY_REGISTERED: 'CNPJ_ALREADY_REGISTERED',
    LOGO_URL_INVALID: 'LOGO_URL_INVALID',
    MEDIA_NOT_CONFIGURED: 'MEDIA_NOT_CONFIGURED',
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
    BILLING_PLAN_NOT_FOUND: 404,
    BILLING_ACCOUNT_NOT_FOUND: 404,
    ACCOUNT_PARENT_INVALID: 400,
    ACCOUNT_PARENT_NOT_SYNTHETIC: 400,
    ACCOUNT_ANALYTIC_REQUIRES_PARENT: 400,
    ACCOUNT_MAX_DEPTH_EXCEEDED: 400,
    ACCOUNT_HAS_CHILDREN: 409,
    PLAN_HAS_ACCOUNTS: 409,
    CNPJ_ALREADY_REGISTERED: 409,
    LOGO_URL_INVALID: 400,
    MEDIA_NOT_CONFIGURED: 503,
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
