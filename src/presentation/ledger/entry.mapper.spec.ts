import { toEntryResponse } from '@/presentation/ledger/entry.mapper.js';
import { entryFixture } from '@test/support/ledger-fakes.js';

describe('toEntryResponse', () => {
    it('devolve o pagamento com valores em texto e os nomes do título e da conta', () => {
        const entry = entryFixture({
            interestAmount: 5000,
            fineAmount: 2000,
            discountAmount: 3000,
            principalAmount: 100000,
            totalAmount: 104000,
        });
        expect(
            toEntryResponse({
                entry,
                titleDescription: 'Venda',
                titleType: 'INCOME',
                billingAccountName: 'Banco',
            }),
        ).toEqual({
            id: 'e1',
            titleId: 't1',
            titleDescription: 'Venda',
            titleType: 'INCOME',
            kind: 'PAYMENT',
            billingAccountId: 'bank',
            billingAccountName: 'Banco',
            principalAmount: '1000.00',
            interestAmount: '50.00',
            fineAmount: '20.00',
            discountAmount: '30.00',
            totalAmount: '1040.00',
            paidAt: '2026-10-10',
            paymentMethod: 'PIX',
            description: '',
            createdAt: '2026-10-10T00:00:00.000Z',
        });
    });

    it('baixa por perda não tem conta nem forma de pagamento', () => {
        const entry = entryFixture({
            kind: 'WRITE_OFF',
            billingAccountId: null,
            paymentMethod: null,
            totalAmount: 0,
        });
        expect(
            toEntryResponse({
                entry,
                titleDescription: 'Venda',
                titleType: 'INCOME',
                billingAccountName: null,
            }),
        ).toMatchObject({
            kind: 'WRITE_OFF',
            billingAccountId: null,
            billingAccountName: null,
            paymentMethod: null,
            totalAmount: '0.00',
        });
    });
});
