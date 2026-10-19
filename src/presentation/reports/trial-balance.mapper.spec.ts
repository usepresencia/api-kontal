import { AccountNature } from '@/domain/billing/account-nature.js';
import { buildTrialBalance } from '@/domain/reports/trial-balance.js';
import { toTrialBalanceResponse } from '@/presentation/reports/trial-balance.mapper.js';
import { reportAccount } from '@test/support/report-fakes.js';

describe('toTrialBalanceResponse', () => {
    it('devolve as linhas com saldos {amount, side} e os totais em texto', () => {
        const report = buildTrialBalance(
            [
                reportAccount('bank', '1.1', AccountNature.ASSET, { name: 'Banco' }),
                reportAccount('cap', '5.1', AccountNature.EQUITY),
            ],
            [
                {
                    accountId: 'bank',
                    openingDebit: 100000,
                    openingCredit: 0,
                    debit: 5050,
                    credit: 0,
                },
                {
                    accountId: 'cap',
                    openingDebit: 0,
                    openingCredit: 100000,
                    debit: 0,
                    credit: 5050,
                },
            ],
            {},
        );
        const response = toTrialBalanceResponse({
            billingPlanId: 'p1',
            start: new Date('2026-10-01T00:00:00.000Z'),
            end: new Date('2026-10-31T00:00:00.000Z'),
            report,
        });
        expect(response).toMatchObject({
            billingPlanId: 'p1',
            start: '2026-10-01',
            end: '2026-10-31',
        });
        expect(response.lines[0]).toEqual({
            accountId: 'bank',
            code: '1.1',
            name: 'Banco',
            level: 2,
            nature: 'ASSET',
            accountType: 'ANALYTIC',
            openingBalance: { amount: '1000.00', side: 'D' },
            debits: '50.50',
            credits: '0.00',
            closingBalance: { amount: '1050.50', side: 'D' },
        });
        expect(response.lines[1].closingBalance).toEqual({ amount: '1050.50', side: 'C' });
        expect(response.totals).toEqual({
            debits: '50.50',
            credits: '50.50',
            openingDebitBalances: '1000.00',
            openingCreditBalances: '1000.00',
            closingDebitBalances: '1050.50',
            closingCreditBalances: '1050.50',
        });
    });
});
