import { AccountNature } from '@/domain/billing/account-nature.js';
import { CostBehavior } from '@/domain/billing/cost-behavior.js';
import { DreCategory } from '@/domain/billing/dre-category.js';
import { buildDre } from '@/domain/reports/dre.js';
import { buildManagementDre, marginBps } from '@/domain/reports/management-dre.js';
import { reportAccount } from '@test/support/report-fakes.js';

const { ASSET, REVENUE, EXPENSE } = AccountNature;
const rev = (id: string, code: string, dreCategory: DreCategory | null) =>
    reportAccount(id, code, REVENUE, { dreCategory });
const exp = (
    id: string,
    code: string,
    dreCategory: DreCategory | null,
    costBehavior: CostBehavior | null = null,
) => reportAccount(id, code, EXPENSE, { dreCategory, costBehavior });

const accounts = [
    reportAccount('bank', '1.1', ASSET),
    rev('sales', '3.1', DreCategory.GROSS_REVENUE),
    rev('otherRev', '3.2', DreCategory.OTHER_REVENUE),
    rev('finRev', '3.3', DreCategory.FINANCIAL_REVENUE),
    exp('tax', '4.1', DreCategory.REVENUE_DEDUCTION),
    exp('cogs', '4.2', DreCategory.COST_OF_SALES),
    exp('commission', '4.3', DreCategory.OPERATING_EXPENSE, CostBehavior.VARIABLE),
    exp('rent', '4.4', DreCategory.OPERATING_EXPENSE),
    exp('deprec', '4.5', DreCategory.OPERATING_EXPENSE, CostBehavior.DEPRECIATION),
    exp('otherExp', '4.6', DreCategory.OTHER_EXPENSE),
    exp('finExp', '4.7', DreCategory.FINANCIAL_EXPENSE, CostBehavior.VARIABLE),
    exp('incomeTax', '4.8', DreCategory.INCOME_TAX),
    exp('plain', '4.9', null),
];
const move = (accountId: string, debit: number, credit: number, month = '2026-10') => ({
    accountId,
    month,
    debit,
    credit,
});
const movements = [
    move('bank', 50000, 0),
    move('sales', 0, 100000),
    move('otherRev', 0, 1000),
    move('finRev', 0, 3000),
    move('tax', 10000, 0),
    move('cogs', 30000, 0),
    move('commission', 5000, 0),
    move('rent', 20000, 0),
    move('deprec', 2000, 0),
    move('otherExp', 500, 0),
    move('finExp', 1500, 0),
    move('incomeTax', 4000, 0),
];

describe('buildManagementDre', () => {
    const report = buildManagementDre(accounts, movements, { byMonth: false });

    it('margem de contribuição, fixos, depreciação e resultado; financeiras e impostos ignoram o comportamento', () => {
        expect(report.lines).toEqual({
            grossRevenue: 100000,
            revenueDeductions: 10000,
            netRevenue: 90000,
            variableCosts: 35000,
            contributionMargin: 55000,
            fixedCosts: 20500,
            otherRevenue: 1000,
            resultBeforeDepreciation: 35500,
            depreciation: 2000,
            operatingResult: 33500,
            financialRevenue: 3000,
            financialExpenses: 1500,
            financialResult: 1500,
            resultBeforeTaxes: 35000,
            incomeTaxes: 4000,
            netResult: 31000,
        });
        expect(report.contributionMarginBps).toBe(6111);
        expect(report.months).toBeNull();
    });

    it('o resultado líquido fecha com o do DRE contábil', () => {
        expect(report.lines.netResult).toBe(
            buildDre(accounts, movements, { byMonth: false }).lines.netResult,
        );
    });

    it('lista as despesas que caíram no padrão (sem comportamento), na ordem do plano', () => {
        expect(report.unclassified.map(item => [item.accountId, item.amount])).toEqual([
            ['cogs', 30000],
            ['rent', 20000],
            ['otherExp', 500],
        ]);
    });

    it('despesa sem categoria vale despesa operacional fixa e entra nas não classificadas', () => {
        const withPlain = buildManagementDre(
            accounts,
            [move('sales', 0, 1000), move('plain', 300, 0)],
            { byMonth: false },
        );
        expect(withPlain.lines).toMatchObject({
            variableCosts: 0,
            fixedCosts: 300,
            netResult: 700,
        });
        expect(withPlain.unclassified.map(item => item.accountId)).toEqual(['plain']);
    });

    it('comportamento explícito vence o padrão do custo das vendas', () => {
        const fixedCogs = accounts.map(account =>
            account.id === 'cogs' ? { ...account, costBehavior: CostBehavior.FIXED } : account,
        );
        const result = buildManagementDre(fixedCogs, movements, { byMonth: false });
        expect(result.lines).toMatchObject({
            variableCosts: 5000,
            fixedCosts: 50500,
            netResult: 31000,
        });
        expect(result.unclassified.map(item => item.accountId)).toEqual(['rent', 'otherExp']);
    });

    it('série mensal crescente com os totais de cada mês', () => {
        const monthly = buildManagementDre(
            accounts,
            [move('sales', 0, 100000), move('cogs', 30000, 0), move('sales', 0, 20000, '2026-11')],
            { byMonth: true },
        );
        expect(monthly.months).toEqual([
            {
                month: '2026-10',
                netRevenue: 100000,
                contributionMargin: 70000,
                operatingResult: 70000,
                netResult: 70000,
            },
            {
                month: '2026-11',
                netRevenue: 20000,
                contributionMargin: 20000,
                operatingResult: 20000,
                netResult: 20000,
            },
        ]);
    });

    it('sem movimento: tudo zero, margem nula e sem meses', () => {
        const empty = buildManagementDre(accounts, [move('ghost', 1, 0)], { byMonth: true });
        expect(Object.values(empty.lines).every(value => value === 0)).toBe(true);
        expect(empty.contributionMarginBps).toBeNull();
        expect(empty.months).toEqual([]);
        expect(empty.unclassified).toEqual([]);
    });
});

describe('marginBps', () => {
    it.each([
        [55000, 90000, 6111],
        [-2000, 1000, -20000],
        [1, 20000, 1],
        [-1, 20000, -1],
        [1, 3, 3333],
        [0, 5000, 0],
    ])('margem %i sobre %i → %i pontos-base', (margin, net, bps) => {
        expect(marginBps(margin, net)).toBe(bps);
    });

    it('receita líquida zero não tem percentual e líquida negativa mantém o sinal da razão', () => {
        expect(marginBps(100, 0)).toBeNull();
        expect(marginBps(100, -400)).toBe(-2500);
        expect(marginBps(-100, -400)).toBe(2500);
    });
});
