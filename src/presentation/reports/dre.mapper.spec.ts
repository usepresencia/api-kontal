import { AccountNature } from '@/domain/billing/account-nature.js';
import { DreCategory } from '@/domain/billing/dre-category.js';
import { buildDre } from '@/domain/reports/dre.js';
import { toDreResponse } from '@/presentation/reports/dre.mapper.js';
import { reportAccount, synthetic } from '@test/support/report-fakes.js';

const accounts = [
    reportAccount('r3', '3', AccountNature.REVENUE, { ...synthetic, name: 'Receitas' }),
    reportAccount('sales', '3.1', AccountNature.REVENUE, {
        parentId: 'r3',
        name: 'Vendas',
        dreCategory: DreCategory.GROSS_REVENUE,
    }),
    reportAccount('misc', '4.1', AccountNature.EXPENSE, { name: 'Diversos' }),
];
const movements = [
    { accountId: 'sales', month: '2026-10', debit: 0, credit: 100050 },
    { accountId: 'misc', month: '2026-10', debit: 250000, credit: 0 },
];
const period = {
    billingPlanId: 'p1',
    start: new Date('2026-10-01T00:00:00.000Z'),
    end: new Date('2026-10-31T00:00:00.000Z'),
};

describe('toDreResponse', () => {
    it('devolve linhas, totais, árvores e não classificadas com valores com sinal em texto', () => {
        const response = toDreResponse({
            ...period,
            report: buildDre(accounts, movements, { byMonth: true }),
        });
        expect(response).toMatchObject({
            billingPlanId: 'p1',
            start: '2026-10-01',
            end: '2026-10-31',
            totals: { revenues: '1000.50', expenses: '2500.00', result: '-1499.50' },
            unclassified: [
                {
                    accountId: 'misc',
                    code: '4.1',
                    name: 'Diversos',
                    nature: 'EXPENSE',
                    amount: '2500.00',
                },
            ],
            months: [
                { month: '2026-10', revenues: '1000.50', expenses: '2500.00', result: '-1499.50' },
            ],
        });
        expect(response.lines).toMatchObject({
            grossRevenue: '1000.50',
            operatingExpenses: '2500.00',
            netResult: '-1499.50',
        });
        expect(Object.keys(response.lines)).toHaveLength(14);
        expect(response.revenueTree).toEqual([
            {
                id: 'r3',
                code: '3',
                name: 'Receitas',
                level: 1,
                accountType: 'SYNTHETIC',
                dreCategory: null,
                amount: '1000.50',
                children: [
                    {
                        id: 'sales',
                        code: '3.1',
                        name: 'Vendas',
                        level: 2,
                        accountType: 'ANALYTIC',
                        dreCategory: 'GROSS_REVENUE',
                        amount: '1000.50',
                        children: [],
                    },
                ],
            },
        ]);
    });

    it('sem agrupamento mensal a chave months não aparece', () => {
        const response = toDreResponse({
            ...period,
            report: buildDre(accounts, movements, { byMonth: false }),
        });
        expect('months' in response).toBe(false);
    });
});
