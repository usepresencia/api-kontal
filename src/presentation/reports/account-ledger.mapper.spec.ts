import { AccountNature } from '@/domain/billing/account-nature.js';
import { toAccountLedgerResponse } from '@/presentation/reports/account-ledger.mapper.js';
import { reportAccount } from '@test/support/report-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const base = {
    account: reportAccount('bank', '1.1', AccountNature.ASSET, { name: 'Banco' }),
    start: day('2026-10-01'),
    end: day('2026-10-31'),
    openingBalance: { amount: 1000, side: 'D' as const },
    closingBalance: { amount: 50, side: 'C' as const },
};

describe('toAccountLedgerResponse', () => {
    it('modo por lançamento: conta, saldos e página de itens em texto', () => {
        const response = toAccountLedgerResponse({
            ...base,
            items: {
                items: [
                    {
                        journalEntryId: 'j1',
                        number: 3,
                        date: day('2026-10-02'),
                        description: 'Venda',
                        referenceType: 'MANUAL',
                        debit: 0,
                        credit: 1050,
                        balance: { amount: 50, side: 'C' },
                        counterparts: [{ code: '3.1', name: 'Vendas' }],
                    },
                ],
                page: 1,
                pageSize: 10,
                total: 1,
            },
            days: null,
        });
        expect(response).toMatchObject({
            account: {
                id: 'bank',
                code: '1.1',
                name: 'Banco',
                nature: 'ASSET',
                accountType: 'ANALYTIC',
            },
            start: '2026-10-01',
            end: '2026-10-31',
            openingBalance: { amount: '10.00', side: 'D' },
            closingBalance: { amount: '0.50', side: 'C' },
            page: 1,
            pageSize: 10,
            total: 1,
        });
        expect('days' in response).toBe(false);
        if (!('items' in response)) throw new Error('esperado o modo por lançamento');
        expect(response.items[0]).toEqual({
            date: '2026-10-02',
            number: 3,
            journalEntryId: 'j1',
            description: 'Venda',
            referenceType: 'MANUAL',
            debit: '0.00',
            credit: '10.50',
            balance: { amount: '0.50', side: 'C' },
            counterparts: [{ code: '3.1', name: 'Vendas' }],
        });
    });

    it('modo por dia: lista de dias sem paginação', () => {
        const response = toAccountLedgerResponse({
            ...base,
            items: null,
            days: [
                {
                    date: day('2026-10-02'),
                    debits: 0,
                    credits: 1050,
                    balance: { amount: 50, side: 'C' },
                },
            ],
        });
        expect('items' in response).toBe(false);
        if (!('days' in response)) throw new Error('esperado o modo por dia');
        expect(response.days).toEqual([
            {
                date: '2026-10-02',
                debits: '0.00',
                credits: '10.50',
                balance: { amount: '0.50', side: 'C' },
            },
        ]);
    });
});
