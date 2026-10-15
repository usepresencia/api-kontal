import type { JournalLine } from '@/domain/entities/journal-entry.entity.js';
import {
    type ChargeAccounts,
    creationLines,
    paymentLines,
    type PostingAccounts,
    resolveTitleAccounts,
    reversalDate,
    reverseLines,
    writeOffLines,
} from '@/domain/ledger/posting.policy.js';
import { TitleType } from '@/domain/ledger/title-type.js';

const income: PostingAccounts = {
    type: TitleType.INCOME,
    controlAccountId: 'ar',
    resultAccountId: 'rev',
};
const expense: PostingAccounts = {
    type: TitleType.EXPENSE,
    controlAccountId: 'ap',
    resultAccountId: 'exp',
};
const charges: ChargeAccounts = {
    interestIncome: 'jr',
    discountGranted: 'dc',
    badDebt: 'pd',
    interestExpense: 'jp',
    discountObtained: 'do',
    debtForgiveness: 'pf',
};
const noCharges: ChargeAccounts = {
    interestIncome: null,
    discountGranted: null,
    badDebt: null,
    interestExpense: null,
    discountObtained: null,
    debtForgiveness: null,
};
const amounts = { principal: 100000, interest: 5000, fine: 2000, discount: 3000, total: 104000 };

const sum = (lines: readonly JournalLine[], side: 'debit' | 'credit') =>
    lines.reduce((acc, line) => acc + line[side], 0);
const strip = (lines: readonly JournalLine[]) =>
    lines.map(({ accountId, debit, credit }) => ({ accountId, debit, credit }));
const notPostable = (fn: () => unknown, code: string) => {
    expect(fn).toThrow(expect.objectContaining({ code }));
};

describe('resolveTitleAccounts', () => {
    const preset = { receivable: 'ar', payable: 'ap', revenue: 'rev', expense: 'exp' };

    it('receita: controle a receber e resultado receita', () => {
        expect(resolveTitleAccounts(TitleType.INCOME, preset)).toEqual({
            controlAccountId: 'ar',
            resultAccountId: 'rev',
        });
    });

    it('despesa: controle a pagar e resultado despesa', () => {
        expect(resolveTitleAccounts(TitleType.EXPENSE, preset)).toEqual({
            controlAccountId: 'ap',
            resultAccountId: 'exp',
        });
    });

    it.each([
        ['receita sem conta de receita', TitleType.INCOME, { ...preset, revenue: null }],
        ['despesa sem conta de despesa', TitleType.EXPENSE, { ...preset, expense: null }],
        ['receita sem conta a receber', TitleType.INCOME, { ...preset, receivable: null }],
        ['despesa sem conta a pagar', TitleType.EXPENSE, { ...preset, payable: null }],
    ])('%s responde TITLE_NOT_POSTABLE', (_label, type, accounts) => {
        notPostable(() => resolveTitleAccounts(type, accounts), 'TITLE_NOT_POSTABLE');
    });
});

describe('creationLines', () => {
    it('receita: D a receber / C receita', () => {
        expect(strip(creationLines(income, 100000, 'm'))).toEqual([
            { accountId: 'ar', debit: 100000, credit: 0 },
            { accountId: 'rev', debit: 0, credit: 100000 },
        ]);
    });

    it('despesa: D despesa / C a pagar', () => {
        expect(strip(creationLines(expense, 100000, 'm'))).toEqual([
            { accountId: 'exp', debit: 100000, credit: 0 },
            { accountId: 'ap', debit: 0, credit: 100000 },
        ]);
    });
});

describe('paymentLines: receita', () => {
    it('pagamento simples: D conta da baixa / C a receber', () => {
        const lines = paymentLines(
            income,
            'bank',
            { principal: 30000, interest: 0, fine: 0, discount: 0, total: 30000 },
            noCharges,
            'm',
        );
        expect(strip(lines)).toEqual([
            { accountId: 'bank', debit: 30000, credit: 0 },
            { accountId: 'ar', debit: 0, credit: 30000 },
        ]);
    });

    it('com juros, multa e desconto: balanceado e nas contas certas', () => {
        const lines = paymentLines(income, 'bank', amounts, charges, 'm');
        expect(strip(lines)).toEqual([
            { accountId: 'bank', debit: 104000, credit: 0 },
            { accountId: 'dc', debit: 3000, credit: 0 },
            { accountId: 'ar', debit: 0, credit: 100000 },
            { accountId: 'jr', debit: 0, credit: 7000 },
        ]);
        expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    });

    it.each([
        [
            'juros sem conta de juros recebidos',
            { ...amounts, discount: 0, total: 107000 },
            'interestIncome',
        ],
        [
            'multa sem conta de juros recebidos',
            { principal: 1000, interest: 0, fine: 100, discount: 0, total: 1100 },
            'interestIncome',
        ],
        [
            'desconto sem conta de desconto concedido',
            { principal: 1000, interest: 0, fine: 0, discount: 100, total: 900 },
            'discountGranted',
        ],
    ])('%s responde SETTLEMENT_NOT_POSTABLE', (_label, value) => {
        notPostable(
            () => paymentLines(income, 'bank', value, noCharges, 'm'),
            'SETTLEMENT_NOT_POSTABLE',
        );
    });
});

describe('paymentLines: despesa', () => {
    it('pagamento simples: D a pagar / C conta da baixa', () => {
        const lines = paymentLines(
            expense,
            'bank',
            { principal: 30000, interest: 0, fine: 0, discount: 0, total: 30000 },
            noCharges,
            'm',
        );
        expect(strip(lines)).toEqual([
            { accountId: 'ap', debit: 30000, credit: 0 },
            { accountId: 'bank', debit: 0, credit: 30000 },
        ]);
    });

    it('com juros, multa e desconto: balanceado e nas contas certas', () => {
        const lines = paymentLines(expense, 'bank', amounts, charges, 'm');
        expect(strip(lines)).toEqual([
            { accountId: 'ap', debit: 100000, credit: 0 },
            { accountId: 'jp', debit: 7000, credit: 0 },
            { accountId: 'bank', debit: 0, credit: 104000 },
            { accountId: 'do', debit: 0, credit: 3000 },
        ]);
        expect(sum(lines, 'debit')).toBe(sum(lines, 'credit'));
    });

    it.each([
        [
            'juros sem conta de juros pagos',
            { principal: 1000, interest: 100, fine: 0, discount: 0, total: 1100 },
        ],
        [
            'desconto sem conta de desconto obtido',
            { principal: 1000, interest: 0, fine: 0, discount: 100, total: 900 },
        ],
    ])('%s responde SETTLEMENT_NOT_POSTABLE', (_label, value) => {
        notPostable(
            () => paymentLines(expense, 'bank', value, noCharges, 'm'),
            'SETTLEMENT_NOT_POSTABLE',
        );
    });
});

describe('writeOffLines', () => {
    it('receita: D perda com cliente / C a receber', () => {
        expect(strip(writeOffLines(income, 70000, charges, 'm'))).toEqual([
            { accountId: 'pd', debit: 70000, credit: 0 },
            { accountId: 'ar', debit: 0, credit: 70000 },
        ]);
    });

    it('despesa: D a pagar / C perdão de dívida', () => {
        expect(strip(writeOffLines(expense, 70000, charges, 'm'))).toEqual([
            { accountId: 'ap', debit: 70000, credit: 0 },
            { accountId: 'pf', debit: 0, credit: 70000 },
        ]);
    });

    it.each([
        ['receita sem conta de perda', income],
        ['despesa sem conta de perdão', expense],
    ])('%s responde SETTLEMENT_NOT_POSTABLE', (_label, accounts) => {
        notPostable(() => writeOffLines(accounts, 100, noCharges, 'm'), 'SETTLEMENT_NOT_POSTABLE');
    });
});

describe('reverseLines', () => {
    it('inverte débito e crédito e prefixa o histórico', () => {
        const original = creationLines(income, 100000, 'Criação');
        const reversed = reverseLines(original, 'Estorno');
        expect(reversed).toEqual([
            { accountId: 'ar', debit: 0, credit: 100000, memo: 'Estorno: Criação' },
            { accountId: 'rev', debit: 100000, credit: 0, memo: 'Estorno: Criação' },
        ]);
        expect(sum(reversed, 'debit')).toBe(sum(reversed, 'credit'));
    });
});

describe('reversalDate', () => {
    const jan = new Date('2026-01-10T00:00:00.000Z');
    const jun = new Date('2026-06-05T00:00:00.000Z');

    it('evento depois do lançamento original usa a data do evento', () => {
        expect(reversalDate(jun, jan)).toEqual(jun);
    });

    it('evento antes do lançamento original (ocorrência futura) usa a data do original', () => {
        expect(reversalDate(jan, jun)).toEqual(jun);
    });

    it('datas iguais devolvem a mesma data', () => {
        expect(reversalDate(jan, new Date(jan))).toEqual(jan);
    });
});
