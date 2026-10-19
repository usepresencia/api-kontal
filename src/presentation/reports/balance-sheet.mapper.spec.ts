import { AccountNature } from '@/domain/billing/account-nature.js';
import { BalanceCategory } from '@/domain/billing/balance-category.js';
import { buildBalanceSheet } from '@/domain/reports/balance-sheet.js';
import { toBalanceSheetResponse } from '@/presentation/reports/balance-sheet.mapper.js';
import { reportAccount } from '@test/support/report-fakes.js';

describe('toBalanceSheetResponse', () => {
    it('devolve grupos com árvore e total, PL com resultado acumulado e a prova, em texto com sinal', () => {
        const sheet = buildBalanceSheet(
            [
                reportAccount('bank', '1.1', AccountNature.ASSET, {
                    name: 'Banco',
                    balanceCategory: BalanceCategory.CURRENT_ASSET,
                }),
                reportAccount('dep', '1.2', AccountNature.ASSET, {
                    name: 'Depreciação',
                    balanceCategory: BalanceCategory.NON_CURRENT_ASSET,
                }),
                reportAccount('capital', '5.1', AccountNature.EQUITY, { name: 'Capital' }),
                reportAccount('exp', '4.1', AccountNature.EXPENSE),
            ],
            [
                { accountId: 'bank', debit: 100000, credit: 0 },
                { accountId: 'dep', debit: 0, credit: 1050 },
                { accountId: 'capital', debit: 0, credit: 100000 },
                { accountId: 'exp', debit: 1050, credit: 0 },
            ],
        );
        const response = toBalanceSheetResponse({
            billingPlanId: 'p1',
            date: new Date('2026-10-31T00:00:00.000Z'),
            sheet,
        });
        expect(response).toMatchObject({
            billingPlanId: 'p1',
            date: '2026-10-31',
            assets: {
                current: { total: '1000.00' },
                nonCurrent: { total: '-10.50' },
                total: '989.50',
            },
            liabilities: {
                current: { total: '0.00', tree: [] },
                nonCurrent: { total: '0.00' },
                total: '0.00',
            },
            equity: {
                accounts: { total: '1000.00' },
                accumulatedResult: '-10.50',
                total: '989.50',
            },
            liabilitiesAndEquity: '989.50',
            unclassified: [],
        });
        expect(response.assets.nonCurrent.tree[0]).toEqual({
            id: 'dep',
            code: '1.2',
            name: 'Depreciação',
            level: 2,
            accountType: 'ANALYTIC',
            balanceCategory: 'NON_CURRENT_ASSET',
            amount: '-10.50',
            children: [],
        });
    });
});
