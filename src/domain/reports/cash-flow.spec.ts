import { AccountNature } from '@/domain/billing/account-nature.js';
import { buildCashFlow, withPayments } from '@/domain/reports/cash-flow.js';
import { reportAccount } from '@test/support/report-fakes.js';

const accounts = [
    reportAccount('bank', '1.1', AccountNature.ASSET),
    reportAccount('cash', '1.2', AccountNature.ASSET),
    reportAccount('idle', '1.3', AccountNature.ASSET),
];
const row = (accountId: string, bucket: string, type: 'INCOME' | 'EXPENSE', amount: number) => ({
    accountId,
    bucket,
    type,
    amount,
});
const rows = [
    row('bank', '2026-10', 'INCOME', 100000),
    row('bank', '2026-10', 'EXPENSE', 30000),
    row('cash', '2026-11', 'INCOME', 5000),
    row('cash', '2026-10', 'EXPENSE', 8000),
    row('ghost', '2026-10', 'INCOME', 999),
];

describe('buildCashFlow', () => {
    it('totais e contas em ordem do plano, ignorando contas fora do plano e sem movimento', () => {
        const report = buildCashFlow(accounts, rows, undefined);
        expect(report.totals).toEqual({ inflows: 105000, outflows: 38000, net: 67000 });
        expect(
            report.accounts.map(line => [line.account.id, line.inflows, line.outflows, line.net]),
        ).toEqual([
            ['bank', 100000, 30000, 70000],
            ['cash', 5000, 8000, -3000],
        ]);
        expect(report.buckets).toBeNull();
    });

    it('com groupBy devolve os períodos em ordem crescente, só com movimento', () => {
        const report = buildCashFlow(accounts, rows, 'month');
        expect(report.buckets).toEqual([
            { key: '2026-10', inflows: 100000, outflows: 38000, net: 62000 },
            { key: '2026-11', inflows: 5000, outflows: 0, net: 5000 },
        ]);
    });

    it('as três visões somam o mesmo líquido e sem movimento tudo é zero', () => {
        const report = buildCashFlow(accounts, rows, 'day');
        const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
        expect(sum(report.accounts.map(line => line.net))).toBe(report.totals.net);
        expect(sum((report.buckets ?? []).map(bucket => bucket.net))).toBe(report.totals.net);
        expect(buildCashFlow(accounts, [], 'month')).toEqual({
            totals: { inflows: 0, outflows: 0, net: 0 },
            accounts: [],
            buckets: [],
        });
    });
});

describe('withPayments', () => {
    const payment = (entryId: string, date: string) => ({
        entryId,
        titleId: 't',
        titleDescription: 'd',
        type: 'INCOME' as const,
        accountId: 'bank',
        accountCode: '1.1',
        accountName: 'Banco',
        paymentMethod: 'PIX' as const,
        paidAt: new Date(`${date}T00:00:00.000Z`),
        amount: 100,
    });

    it('anexa a cada dia os pagamentos dele, mantendo a ordem recebida', () => {
        const days = withPayments(
            [
                { key: '2026-10-01', inflows: 200, outflows: 0, net: 200 },
                { key: '2026-10-02', inflows: 100, outflows: 0, net: 100 },
            ],
            [payment('a', '2026-10-01'), payment('b', '2026-10-01'), payment('c', '2026-10-02')],
        );
        expect(days.map(day => day.payments.map(item => item.entryId))).toEqual([
            ['a', 'b'],
            ['c'],
        ]);
    });

    it('dia sem pagamentos carregados fica com lista vazia', () => {
        expect(
            withPayments([{ key: '2026-10-01', inflows: 0, outflows: 0, net: 0 }], [])[0].payments,
        ).toEqual([]);
    });
});
