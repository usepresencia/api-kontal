import { resolveTitleAccounts } from '@/domain/ledger/posting.policy.js';

const preset = { receivable: 'ar', payable: 'ap', revenue: 'rev', expense: null };

describe('resolveTitleAccounts: conta de destino', () => {
    it('o destino substitui a conta de despesa e dispensa a do preset', () => {
        expect(resolveTitleAccounts('EXPENSE', preset, 'imob')).toEqual({
            controlAccountId: 'ap',
            resultAccountId: 'imob',
        });
    });

    it('sem destino vale a conta do preset; sem ela, TITLE_NOT_POSTABLE', () => {
        expect(resolveTitleAccounts('INCOME', preset)).toEqual({
            controlAccountId: 'ar',
            resultAccountId: 'rev',
        });
        expect(() => resolveTitleAccounts('EXPENSE', preset)).toThrow(
            expect.objectContaining({ code: 'TITLE_NOT_POSTABLE' }),
        );
    });
});
