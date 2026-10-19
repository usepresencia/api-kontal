import { AccountNature } from '@/domain/billing/account-nature.js';
import { DreCategory } from '@/domain/billing/dre-category.js';
import { buildDre } from '@/domain/reports/dre.js';
import { reportAccount, synthetic } from '@test/support/report-fakes.js';

const { ASSET, REVENUE, EXPENSE } = AccountNature;
const rev = (id: string, code: string, dreCategory: DreCategory | null) =>
    reportAccount(id, code, REVENUE, { parentId: 'r3', dreCategory });
const exp = (id: string, code: string, dreCategory: DreCategory | null) =>
    reportAccount(id, code, EXPENSE, { parentId: 'e4', dreCategory });

const accounts = [
    reportAccount('bank', '1.1', ASSET),
    reportAccount('r3', '3', REVENUE, synthetic),
    rev('sales', '3.1', DreCategory.GROSS_REVENUE),
    rev('interest', '3.2', DreCategory.FINANCIAL_REVENUE),
    rev('otherRev', '3.3', DreCategory.OTHER_REVENUE),
    rev('noCatRev', '3.4', null),
    rev('idle', '3.5', DreCategory.GROSS_REVENUE),
    reportAccount('e4', '4', EXPENSE, synthetic),
    exp('taxSales', '4.1', DreCategory.REVENUE_DEDUCTION),
    exp('cogs', '4.2', DreCategory.COST_OF_SALES),
    exp('admin', '4.3', DreCategory.OPERATING_EXPENSE),
    exp('interestPaid', '4.4', DreCategory.FINANCIAL_EXPENSE),
    exp('otherExp', '4.5', DreCategory.OTHER_EXPENSE),
    exp('incomeTax', '4.6', DreCategory.INCOME_TAX),
    exp('noCatExp', '4.7', null),
];
const oct = (accountId: string, debit: number, credit: number) => ({
    accountId,
    month: '2026-10',
    debit,
    credit,
});
const movements = [
    oct('bank', 50000, 0),
    oct('sales', 0, 100000),
    { accountId: 'sales', month: '2026-11', debit: 5000, credit: 0 },
    oct('interest', 0, 2000),
    oct('otherRev', 0, 1000),
    oct('noCatRev', 0, 500),
    oct('taxSales', 9000, 0),
    oct('cogs', 30000, 0),
    oct('admin', 20000, 0),
    oct('interestPaid', 1500, 0),
    oct('otherExp', 700, 0),
    oct('incomeTax', 4000, 0),
    oct('noCatExp', 300, 0),
    oct('foreign', 0, 999),
];

describe('buildDre', () => {
    const report = buildDre(accounts, movements, { byMonth: true });

    it('monta as linhas do CPC 26; sem categoria vale receita bruta e despesa operacional', () => {
        expect(report.lines).toEqual({
            grossRevenue: 95500,
            revenueDeductions: 9000,
            netRevenue: 86500,
            costOfSales: 30000,
            grossProfit: 56500,
            operatingExpenses: 20300,
            otherOperatingResult: 300,
            operatingResult: 36500,
            financialRevenue: 2000,
            financialExpenses: 1500,
            financialResult: 500,
            resultBeforeTaxes: 37000,
            incomeTaxes: 4000,
            netResult: 33000,
        });
    });

    it('totais por natureza fecham com o resultado líquido; patrimoniais e contas de fora do plano não entram', () => {
        expect(report.totals).toEqual({ revenues: 98500, expenses: 65500, result: 33000 });
        expect(report.totals.result).toBe(report.lines.netResult);
    });

    it('árvores somadas por natureza, sem as contas sem movimento', () => {
        expect(report.revenueTree.map(node => [node.account.id, node.value])).toEqual([
            ['r3', 98500],
        ]);
        expect(report.revenueTree[0].children.map(node => node.account.id)).toEqual([
            'sales',
            'interest',
            'otherRev',
            'noCatRev',
        ]);
        expect(report.expenseTree[0].value).toBe(65500);
    });

    it('lista as contas com movimento sem categoria, na ordem do plano', () => {
        expect(report.unclassified).toEqual([
            {
                accountId: 'noCatRev',
                code: '3.4',
                name: 'noCatRev',
                nature: 'REVENUE',
                amount: 500,
            },
            {
                accountId: 'noCatExp',
                code: '4.7',
                name: 'noCatExp',
                nature: 'EXPENSE',
                amount: 300,
            },
        ]);
    });

    it('série mensal em ordem crescente, só com meses de movimento, somando o resultado do período', () => {
        expect(report.months).toEqual([
            { month: '2026-10', revenues: 103500, expenses: 65500, result: 38000 },
            { month: '2026-11', revenues: -5000, expenses: 0, result: -5000 },
        ]);
    });

    it('sem agrupamento mensal, months é null; prejuízo sai negativo', () => {
        const loss = buildDre(accounts, [oct('admin', 1000, 0)], { byMonth: false });
        expect(loss.months).toBeNull();
        expect(loss.lines.netResult).toBe(-1000);
        expect(loss.totals).toEqual({ revenues: 0, expenses: 1000, result: -1000 });
    });

    it('sem movimento tudo é zero e as árvores ficam vazias', () => {
        const empty = buildDre(accounts, [], { byMonth: true });
        expect(Object.values(empty.lines).every(value => value === 0)).toBe(true);
        expect(empty.revenueTree).toEqual([]);
        expect(empty.months).toEqual([]);
    });
});
