import { AccountNature } from '@/domain/billing/account-nature.js';
import { buildTrialBalance } from '@/domain/reports/trial-balance.js';
import { reportAccount, synthetic } from '@test/support/report-fakes.js';

const { ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE } = AccountNature;
const accounts = [
    reportAccount('a1', '1', ASSET, synthetic),
    reportAccount('bank', '1.1', ASSET, { parentId: 'a1' }),
    reportAccount('clients', '1.2', ASSET, { parentId: 'a1' }),
    reportAccount('oldCash', '1.3', ASSET, { parentId: 'a1' }),
    reportAccount('l2', '2', LIABILITY, synthetic),
    reportAccount('suppliers', '2.1', LIABILITY, { parentId: 'l2' }),
    reportAccount('r3', '3', REVENUE, synthetic),
    reportAccount('sales', '3.1', REVENUE, { parentId: 'r3' }),
    reportAccount('e4', '4', EXPENSE, synthetic),
    reportAccount('admin', '4.1', EXPENSE, { parentId: 'e4' }),
    reportAccount('q5', '5', EQUITY, synthetic),
    reportAccount('capital', '5.1', EQUITY, { parentId: 'q5' }),
];
const row = (
    accountId: string,
    openingDebit: number,
    openingCredit: number,
    debit: number,
    credit: number,
) => ({
    accountId,
    openingDebit,
    openingCredit,
    debit,
    credit,
});
// Antes do período: aporte D banco / C capital 1000. No período: venda a prazo 800, recebimento 500,
// despesa a prazo 300, pagamento ao fornecedor 200. A conta 1.3 tem saldo anterior zerado e nenhum movimento.
const rows = [
    row('bank', 100000, 0, 50000, 20000),
    row('capital', 0, 100000, 0, 0),
    row('clients', 0, 0, 80000, 50000),
    row('sales', 0, 0, 0, 80000),
    row('admin', 0, 0, 30000, 0),
    row('suppliers', 0, 0, 20000, 30000),
    row('oldCash', 500, 500, 0, 0),
];

describe('buildTrialBalance', () => {
    const report = buildTrialBalance(accounts, rows, {});
    const line = (code: string) => report.lines.find(item => item.account.code === code);

    it('lista as contas com saldo ou movimento em ordem do plano, somando nas sintéticas', () => {
        expect(report.lines.map(item => item.account.code)).toEqual([
            '1',
            '1.1',
            '1.2',
            '2',
            '2.1',
            '3',
            '3.1',
            '4',
            '4.1',
            '5',
            '5.1',
        ]);
        expect(line('1')).toMatchObject({
            openingBalance: { amount: 100000, side: 'D' },
            debits: 130000,
            credits: 70000,
            closingBalance: { amount: 160000, side: 'D' },
        });
    });

    it('saldos com lado: devedor, credor e zerado na abertura', () => {
        expect(line('1.2')).toMatchObject({
            openingBalance: { amount: 0, side: 'D' },
            closingBalance: { amount: 30000, side: 'D' },
        });
        expect(line('2.1')).toMatchObject({
            debits: 20000,
            credits: 30000,
            closingBalance: { amount: 10000, side: 'C' },
        });
        expect(line('5.1')).toMatchObject({
            openingBalance: { amount: 100000, side: 'C' },
            debits: 0,
            credits: 0,
            closingBalance: { amount: 100000, side: 'C' },
        });
    });

    it('totais nas analíticas e provas do balancete', () => {
        expect(report.totals).toEqual({
            debits: 180000,
            credits: 180000,
            openingDebitBalances: 100000,
            openingCreditBalances: 100000,
            closingDebitBalances: 190000,
            closingCreditBalances: 190000,
        });
    });

    it('maxLevel limita as linhas sem mudar os totais', () => {
        const top = buildTrialBalance(accounts, rows, { maxLevel: 1 });
        expect(top.lines.map(item => item.account.code)).toEqual(['1', '2', '3', '4', '5']);
        expect(top.totals).toEqual(report.totals);
    });

    it('linhas de contas fora da lista são ignoradas; sem movimento o balancete é vazio', () => {
        expect(buildTrialBalance(accounts, [row('foreign', 1, 0, 0, 0)], {}).lines).toEqual([]);
        expect(buildTrialBalance(accounts, [], {}).totals.debits).toBe(0);
    });
});
