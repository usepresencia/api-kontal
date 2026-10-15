import { AccountNature } from '@/domain/billing/account-nature.js';
import { buildClosingLines } from '@/domain/ledger/closing-entry.js';
import { reportAccount } from '@test/support/report-fakes.js';

const accounts = [
    reportAccount('bank', '1.1', AccountNature.ASSET),
    reportAccount('ret', '2.1', AccountNature.EQUITY),
    reportAccount('rev', '3.1', AccountNature.REVENUE),
    reportAccount('exp', '4.1', AccountNature.EXPENSE),
    reportAccount('exp2', '4.2', AccountNature.EXPENSE),
];
const balance = (accountId: string, debit: number, credit: number) => ({
    accountId,
    debit,
    credit,
});
const view = (lines: { accountId: string; debit: number; credit: number }[] | null) =>
    lines?.map(line => [line.accountId, line.debit, line.credit]);
const totals = (lines: { debit: number; credit: number }[]) => [
    lines.reduce((sum, line) => sum + line.debit, 0),
    lines.reduce((sum, line) => sum + line.credit, 0),
];

describe('buildClosingLines', () => {
    it('lucro: zera receitas (débito) e despesas (crédito) e credita os lucros acumulados', () => {
        const lines = buildClosingLines(
            accounts,
            [balance('rev', 0, 100000), balance('exp', 40000, 0), balance('bank', 60000, 0)],
            'ret',
        );
        expect(view(lines)).toEqual([
            ['rev', 100000, 0],
            ['exp', 0, 40000],
            ['ret', 0, 60000],
        ]);
    });

    it('prejuízo: debita os lucros acumulados', () => {
        const lines = buildClosingLines(
            accounts,
            [balance('rev', 0, 10000), balance('exp', 40000, 0)],
            'ret',
        );
        expect(view(lines)).toEqual([
            ['rev', 10000, 0],
            ['exp', 0, 40000],
            ['ret', 30000, 0],
        ]);
    });

    it('resultado zero: só zera as contas, sem linha de lucros acumulados', () => {
        const lines = buildClosingLines(
            accounts,
            [balance('rev', 0, 500), balance('exp', 500, 0)],
            'ret',
        );
        expect(view(lines)).toEqual([
            ['rev', 500, 0],
            ['exp', 0, 500],
        ]);
    });

    it('receita com saldo devedor e despesa com saldo credor invertem o lado', () => {
        const lines = buildClosingLines(
            accounts,
            [balance('rev', 700, 0), balance('exp', 0, 200)],
            'ret',
        );
        expect(view(lines)).toEqual([
            ['rev', 0, 700],
            ['exp', 200, 0],
            ['ret', 500, 0],
        ]);
    });

    it('ignora contas sem saldo líquido, patrimoniais e fora do plano; soma vários lançamentos da mesma conta', () => {
        const lines = buildClosingLines(
            accounts,
            [
                balance('rev', 0, 100),
                balance('rev', 0, 50),
                balance('exp', 30, 0),
                balance('exp', 0, 30),
                balance('exp2', 0, 0),
                balance('ghost', 1, 0),
                balance('ret', 9, 0),
            ],
            'ret',
        );
        expect(view(lines)).toEqual([
            ['rev', 150, 0],
            ['ret', 0, 150],
        ]);
    });

    it('sem saldo de resultado devolve null', () => {
        expect(
            buildClosingLines(accounts, [balance('bank', 10, 0), balance('exp', 5, 5)], 'ret'),
        ).toBeNull();
        expect(buildClosingLines(accounts, [], 'ret')).toBeNull();
    });

    it('o lançamento sempre fecha: débitos = créditos', () => {
        for (const balances of [
            [balance('rev', 0, 100000), balance('exp', 40000, 0)],
            [balance('rev', 0, 10000), balance('exp', 40000, 0), balance('exp2', 7, 0)],
            [balance('rev', 700, 0), balance('exp', 0, 200)],
        ]) {
            const [debits, credits] = totals(buildClosingLines(accounts, balances, 'ret') ?? []);
            expect(debits).toBe(credits);
        }
    });
});
