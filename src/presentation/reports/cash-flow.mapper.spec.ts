import { AccountNature } from '@/domain/billing/account-nature.js';
import { buildCashFlow, withPayments } from '@/domain/reports/cash-flow.js';
import { toCashFlowResponse } from '@/presentation/reports/cash-flow.mapper.js';
import { reportAccount } from '@test/support/report-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const accounts = [reportAccount('bank', '1.1', AccountNature.ASSET, { name: 'Banco' })];
const rows = [
    { accountId: 'bank', bucket: '2026-10-05', type: 'INCOME' as const, amount: 61500 },
    { accountId: 'bank', bucket: '2026-10-06', type: 'EXPENSE' as const, amount: 100050 },
];
const base = { billingPlanId: 'p1', start: day('2026-10-01'), end: day('2026-10-31') };

describe('toCashFlowResponse', () => {
    it('sem agrupamento devolve só totais e contas, com líquido negativo em texto', () => {
        const response = toCashFlowResponse({
            ...base,
            groupBy: undefined,
            report: buildCashFlow(accounts, rows, undefined),
            days: null,
        });
        expect(response).toEqual({
            billingPlanId: 'p1',
            start: '2026-10-01',
            end: '2026-10-31',
            totals: { inflows: '615.00', outflows: '1000.50', net: '-385.50' },
            accounts: [
                {
                    accountId: 'bank',
                    code: '1.1',
                    name: 'Banco',
                    inflows: '615.00',
                    outflows: '1000.50',
                    net: '-385.50',
                },
            ],
        });
    });

    it('groupBy=month devolve months; groupBy=day devolve days com os pagamentos', () => {
        const month = toCashFlowResponse({
            ...base,
            groupBy: 'month',
            report: buildCashFlow(accounts, rows, 'month'),
            days: null,
        });
        expect(month.months).toEqual([
            { month: '2026-10-05', inflows: '615.00', outflows: '0.00', net: '615.00' },
            { month: '2026-10-06', inflows: '0.00', outflows: '1000.50', net: '-1000.50' },
        ]);
        expect('days' in month).toBe(false);
        const report = buildCashFlow(accounts, rows, 'day');
        const days = withPayments(report.buckets ?? [], [
            {
                entryId: 'e1',
                titleId: 't1',
                titleDescription: 'Venda',
                type: 'INCOME',
                accountId: 'bank',
                accountCode: '1.1',
                accountName: 'Banco',
                paymentMethod: 'PIX',
                paidAt: day('2026-10-05'),
                amount: 61500,
            },
        ]);
        const daily = toCashFlowResponse({ ...base, groupBy: 'day', report, days });
        expect(daily.days?.[0]).toEqual({
            date: '2026-10-05',
            inflows: '615.00',
            outflows: '0.00',
            net: '615.00',
            payments: [
                {
                    entryId: 'e1',
                    titleId: 't1',
                    titleDescription: 'Venda',
                    type: 'INCOME',
                    accountCode: '1.1',
                    accountName: 'Banco',
                    paymentMethod: 'PIX',
                    amount: '615.00',
                },
            ],
        });
        expect('months' in daily).toBe(false);
    });
});
