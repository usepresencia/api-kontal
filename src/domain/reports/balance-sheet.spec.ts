import { AccountNature } from '@/domain/billing/account-nature.js';
import { BalanceCategory } from '@/domain/billing/balance-category.js';
import { buildBalanceSheet } from '@/domain/reports/balance-sheet.js';
import { reportAccount, synthetic } from '@test/support/report-fakes.js';

const { ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE } = AccountNature;
const { CURRENT_ASSET, NON_CURRENT_ASSET, CURRENT_LIABILITY, NON_CURRENT_LIABILITY } =
    BalanceCategory;
const accounts = [
    reportAccount('a1', '1', ASSET, synthetic),
    reportAccount('bank', '1.1', ASSET, { parentId: 'a1', balanceCategory: CURRENT_ASSET }),
    reportAccount('clients', '1.2', ASSET, { parentId: 'a1' }),
    reportAccount('fixed', '1.3', ASSET, {
        parentId: 'a1',
        balanceCategory: NON_CURRENT_ASSET,
        ...synthetic,
    }),
    reportAccount('equipment', '1.3.1', ASSET, {
        parentId: 'fixed',
        balanceCategory: NON_CURRENT_ASSET,
    }),
    reportAccount('depreciation', '1.3.2', ASSET, {
        parentId: 'fixed',
        balanceCategory: NON_CURRENT_ASSET,
    }),
    reportAccount('l2', '2', LIABILITY, synthetic),
    reportAccount('suppliers', '2.1', LIABILITY, {
        parentId: 'l2',
        balanceCategory: CURRENT_LIABILITY,
    }),
    reportAccount('loan', '2.2', LIABILITY, {
        parentId: 'l2',
        balanceCategory: NON_CURRENT_LIABILITY,
    }),
    reportAccount('r3', '3', REVENUE, synthetic),
    reportAccount('sales', '3.1', REVENUE, { parentId: 'r3' }),
    reportAccount('e4', '4', EXPENSE, synthetic),
    reportAccount('depExpense', '4.1', EXPENSE, { parentId: 'e4' }),
    reportAccount('admin', '4.2', EXPENSE, { parentId: 'e4' }),
    reportAccount('q5', '5', EQUITY, synthetic),
    reportAccount('capital', '5.1', EQUITY, { parentId: 'q5' }),
];
// Aporte 1000; empréstimo de longo prazo 500; compra de equipamento 600; venda a prazo 400;
// depreciação 10; despesa a prazo 50.
const balances = [
    { accountId: 'bank', debit: 150000, credit: 60000 },
    { accountId: 'clients', debit: 40000, credit: 0 },
    { accountId: 'equipment', debit: 60000, credit: 0 },
    { accountId: 'depreciation', debit: 0, credit: 1000 },
    { accountId: 'suppliers', debit: 0, credit: 5000 },
    { accountId: 'loan', debit: 0, credit: 50000 },
    { accountId: 'capital', debit: 0, credit: 100000 },
    { accountId: 'sales', debit: 0, credit: 40000 },
    { accountId: 'depExpense', debit: 1000, credit: 0 },
    { accountId: 'admin', debit: 5000, credit: 0 },
    { accountId: 'foreign', debit: 999, credit: 0 },
];

describe('buildBalanceSheet', () => {
    const sheet = buildBalanceSheet(accounts, balances);
    const ids = (tree: { account: { id: string }; value: number }[]) =>
        tree.map(node => [node.account.id, node.value]);

    it('ativo circulante (inclusive sem categoria) e não circulante com conta redutora negativa', () => {
        expect(sheet.assets.current.total).toBe(130000);
        expect(ids(sheet.assets.current.tree)).toEqual([['a1', 130000]]);
        expect(ids(sheet.assets.current.tree[0].children)).toEqual([
            ['bank', 90000],
            ['clients', 40000],
        ]);
        expect(sheet.assets.nonCurrent.total).toBe(59000);
        expect(ids(sheet.assets.nonCurrent.tree)).toEqual([['fixed', 59000]]);
        expect(ids(sheet.assets.nonCurrent.tree[0].children)).toEqual([
            ['equipment', 60000],
            ['depreciation', -1000],
        ]);
        expect(sheet.assets.total).toBe(189000);
    });

    it('passivo circulante e não circulante em crédito − débito', () => {
        expect(ids(sheet.liabilities.current.tree)).toEqual([['l2', 5000]]);
        expect(ids(sheet.liabilities.nonCurrent.tree)).toEqual([['loan', 50000]]);
        expect(sheet.liabilities.total).toBe(55000);
    });

    it('PL com o resultado acumulado não apurado e prova ativo = passivo + PL', () => {
        expect(sheet.equity.accounts.total).toBe(100000);
        expect(sheet.equity.accumulatedResult).toBe(34000);
        expect(sheet.equity.total).toBe(134000);
        expect(sheet.liabilitiesAndEquity).toBe(189000);
        expect(sheet.liabilitiesAndEquity).toBe(sheet.assets.total);
    });

    it('lista ativos e passivos com saldo e sem categoria', () => {
        expect(sheet.unclassified).toEqual([
            { accountId: 'clients', code: '1.2', name: 'clients', nature: 'ASSET', amount: 40000 },
        ]);
    });

    it('prejuízo acumulado reduz o PL; sem lançamentos tudo é zero', () => {
        const loss = buildBalanceSheet(accounts, [
            { accountId: 'admin', debit: 700, credit: 0 },
            { accountId: 'suppliers', debit: 0, credit: 700 },
        ]);
        expect(loss.equity.accumulatedResult).toBe(-700);
        expect(loss.equity.total).toBe(-700);
        expect(loss.liabilitiesAndEquity).toBe(0);
        const empty = buildBalanceSheet(accounts, []);
        expect(empty.assets.total).toBe(0);
        expect(empty.assets.current.tree).toEqual([]);
    });
});
