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
        [ErrorCode.BILLING_PLAN_NOT_FOUND, 404],
        [ErrorCode.BILLING_ACCOUNT_NOT_FOUND, 404],
        [ErrorCode.ACCOUNT_PARENT_INVALID, 400],
        [ErrorCode.ACCOUNT_PARENT_NOT_SYNTHETIC, 400],
        [ErrorCode.ACCOUNT_ANALYTIC_REQUIRES_PARENT, 400],
        [ErrorCode.ACCOUNT_MAX_DEPTH_EXCEEDED, 400],
        [ErrorCode.LOGO_URL_INVALID, 400],
        [ErrorCode.ACCOUNT_HAS_CHILDREN, 409],
        [ErrorCode.PLAN_HAS_ACCOUNTS, 409],
        [ErrorCode.DEFAULT_PLAN_PROTECTED, 409],
        [ErrorCode.CNPJ_ALREADY_REGISTERED, 409],
        [ErrorCode.MEDIA_NOT_CONFIGURED, 503],
        [ErrorCode.PRESET_NOT_FOUND, 404],
        [ErrorCode.TITLE_NOT_FOUND, 404],
        [ErrorCode.ENTRY_NOT_FOUND, 404],
        [ErrorCode.SERIES_NOT_FOUND, 404],
        [ErrorCode.ACCOUNT_NATURE_REQUIRED, 400],
        [ErrorCode.ACCOUNT_NATURE_MISMATCH, 400],
        [ErrorCode.PRESET_ACCOUNT_INVALID, 400],
        [ErrorCode.PRESET_PLAN_MISMATCH, 400],
        [ErrorCode.PRESET_INACTIVE, 400],
        [ErrorCode.TITLE_NOT_POSTABLE, 400],
        [ErrorCode.SETTLEMENT_NOT_POSTABLE, 400],
        [ErrorCode.ENTRY_ACCOUNT_INVALID, 400],
        [ErrorCode.ENTRY_DATE_INVALID, 400],
        [ErrorCode.ENTRY_AMOUNT_INVALID, 400],
        [ErrorCode.SERIES_INVALID, 400],
        [ErrorCode.SERIES_LIMIT_EXCEEDED, 400],
        [ErrorCode.ENTRY_EXCEEDS_BALANCE, 409],
        [ErrorCode.ENTRY_DELETE_BLOCKED, 409],
        [ErrorCode.ACCOUNT_IN_USE, 409],
        [ErrorCode.ACCOUNT_MOVE_INVALID, 400],
        [ErrorCode.PRESET_IN_USE, 409],
        [ErrorCode.PARTY_NOT_FOUND, 404],
        [ErrorCode.PARTY_DOCUMENT_TAKEN, 409],
        [ErrorCode.PARTY_IN_USE, 409],
        [ErrorCode.PARTY_INACTIVE, 409],
        [ErrorCode.PARTY_KIND_MISMATCH, 422],
        [ErrorCode.PARTY_PRESET_REQUIRED, 422],
        [ErrorCode.TITLE_HAS_ENTRIES, 409],
        [ErrorCode.TITLE_FIELD_LOCKED, 409],
        [ErrorCode.TITLE_NOT_OPEN, 409],
        [ErrorCode.SERIES_NOT_EXTENDABLE, 409],
        [ErrorCode.JOURNAL_INVALID, 500],
        [ErrorCode.BILLING_PLAN_REQUIRED, 400],
        [ErrorCode.DATE_RANGE_INVALID, 400],
        [ErrorCode.DRE_CATEGORY_INVALID, 400],
        [ErrorCode.BALANCE_CATEGORY_INVALID, 400],
        [ErrorCode.MANUAL_ENTRY_ACCOUNT_INVALID, 400],
        [ErrorCode.MANUAL_ENTRY_CONTROL_ACCOUNT, 400],
        [ErrorCode.MANUAL_ENTRY_DATE_INVALID, 400],
        [ErrorCode.MANUAL_ENTRY_UNBALANCED, 400],
        [ErrorCode.JOURNAL_ENTRY_NOT_FOUND, 404],
        [ErrorCode.JOURNAL_NOT_REVERSIBLE, 409],
        [ErrorCode.JOURNAL_ALREADY_REVERSED, 409],
        [ErrorCode.COST_BEHAVIOR_INVALID, 400],
        [ErrorCode.DESTINATION_ACCOUNT_INVALID, 400],
        [ErrorCode.OPENING_TITLE_INVALID, 400],
        [ErrorCode.PERIOD_CLOSING_INVALID, 400],
        [ErrorCode.RETAINED_EARNINGS_ACCOUNT_INVALID, 400],
        [ErrorCode.PERIOD_CLOSING_NOT_FOUND, 404],
        [ErrorCode.PERIOD_CLOSED, 409],
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
