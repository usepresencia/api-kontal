import { AccountNature } from '@/domain/billing/account-nature.js';
import { DreCategory } from '@/domain/billing/dre-category.js';
import { buildManagementDre } from '@/domain/reports/management-dre.js';
import { toManagementDreResponse } from '@/presentation/reports/management-dre.mapper.js';
import { reportAccount } from '@test/support/report-fakes.js';

const accounts = [
    reportAccount('sales', '3.1', AccountNature.REVENUE, {
        dreCategory: DreCategory.GROSS_REVENUE,
    }),
    reportAccount('cogs', '4.1', AccountNature.EXPENSE, {
        name: 'CMV',
        dreCategory: DreCategory.COST_OF_SALES,
    }),
];
const movements = [
    { accountId: 'sales', month: '2026-10', debit: 0, credit: 90000 },
    { accountId: 'cogs', month: '2026-10', debit: 35000, credit: 0 },
];
const period = {
    billingPlanId: 'p1',
    start: new Date('2026-10-01T00:00:00.000Z'),
    end: new Date('2026-10-31T00:00:00.000Z'),
};

describe('toManagementDreResponse', () => {
    it('devolve as linhas em texto, o percentual da margem e as não classificadas', () => {
        const response = toManagementDreResponse({
            ...period,
            report: buildManagementDre(accounts, movements, { byMonth: true }),
        });
        expect(response).toMatchObject({
            billingPlanId: 'p1',
            start: '2026-10-01',
            end: '2026-10-31',
            contributionMarginPercent: '61.11',
            unclassified: [
                {
                    accountId: 'cogs',
                    code: '4.1',
                    name: 'CMV',
                    nature: 'EXPENSE',
                    amount: '350.00',
                },
            ],
            months: [
                {
                    month: '2026-10',
                    netRevenue: '900.00',
                    contributionMargin: '550.00',
                    operatingResult: '550.00',
                    netResult: '550.00',
                },
            ],
        });
        expect(response.lines).toMatchObject({
            grossRevenue: '900.00',
            variableCosts: '350.00',
            contributionMargin: '550.00',
            netResult: '550.00',
        });
        expect(Object.keys(response.lines)).toHaveLength(16);
    });

    it('margem nula e sem agrupamento mensal', () => {
        const response = toManagementDreResponse({
            ...period,
            report: buildManagementDre(accounts, [], { byMonth: false }),
        });
        expect(response.contributionMarginPercent).toBeNull();
        expect('months' in response).toBe(false);
    });

    it('margem negativa mantém o sinal', () => {
        const response = toManagementDreResponse({
            ...period,
            report: buildManagementDre(
                accounts,
                [movements[0], { ...movements[1], debit: 120000 }],
                { byMonth: false },
            ),
        });
        expect(response.contributionMarginPercent).toBe('-33.33');
    });
});
