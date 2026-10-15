import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import {
    assertManualAccounts,
    assertManualDate,
    assertManualLines,
    assertReversible,
} from '@/domain/ledger/manual-entry.policy.js';
import { journalFixture } from '@test/support/ledger-fakes.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const fails = (code: string, fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code }));
};
const d = (accountId: string, value: number) => ({ accountId, debit: value, credit: 0, memo: '' });
const c = (accountId: string, value: number) => ({ accountId, debit: 0, credit: value, memo: '' });

describe('assertManualDate', () => {
    it('aceita hoje e o passado; recusa data futura', () => {
        expect(() => assertManualDate(day('2026-10-14'), day('2026-10-14'))).not.toThrow();
        expect(() => assertManualDate(day('2025-01-01'), day('2026-10-14'))).not.toThrow();
        fails('MANUAL_ENTRY_DATE_INVALID', () =>
            assertManualDate(day('2026-10-15'), day('2026-10-14')),
        );
    });
});

describe('assertManualLines', () => {
    it('aceita linhas balanceadas de um lado só, com várias contas', () => {
        expect(() => assertManualLines([d('a', 100), d('b', 50), c('c', 150)])).not.toThrow();
    });

    it.each([
        ['uma linha só', [d('a', 100)]],
        [
            'mais de 50 linhas',
            Array.from({ length: 51 }, (_, i) => (i % 2 ? c('b', 1) : d('a', 1))),
        ],
        ['débitos diferentes dos créditos', [d('a', 100), c('b', 99)]],
        [
            'linha com débito e crédito',
            [{ accountId: 'a', debit: 100, credit: 100, memo: '' }, c('b', 0)],
        ],
        ['linha zerada', [d('a', 0), c('b', 0)]],
        ['valor negativo', [d('a', -100), c('b', -100)]],
        ['valor fracionário', [d('a', 1.5), c('b', 1.5)]],
    ])('recusa %s', (_label, lines) => {
        fails('MANUAL_ENTRY_UNBALANCED', () => assertManualLines(lines));
    });
});

describe('assertManualAccounts', () => {
    const ref = (id: string, overrides: Partial<AccountRef> = {}): AccountRef => ({
        id,
        billingPlanId: 'p1',
        accountType: AccountType.ANALYTIC,
        nature: AccountNature.ASSET,
        isActive: true,
        ...overrides,
    });

    it('aceita contas analíticas, ativas, do mesmo plano e fora do controle de títulos', () => {
        expect(() =>
            assertManualAccounts(['a', 'b'], [ref('a'), ref('b')], new Set()),
        ).not.toThrow();
    });

    it.each([
        ['inexistente ou de outra empresa', [ref('a')]],
        ['sintética', [ref('a'), ref('b', { accountType: AccountType.SYNTHETIC })]],
        ['inativa', [ref('a'), ref('b', { isActive: false })]],
        ['de outro plano', [ref('a'), ref('b', { billingPlanId: 'p2' })]],
    ])('recusa conta %s', (_label, refs) => {
        fails('MANUAL_ENTRY_ACCOUNT_INVALID', () =>
            assertManualAccounts(['a', 'b'], refs, new Set()),
        );
    });

    it('recusa conta de controle de títulos', () => {
        fails('MANUAL_ENTRY_CONTROL_ACCOUNT', () =>
            assertManualAccounts(['a', 'b'], [ref('a'), ref('b')], new Set(['b'])),
        );
    });
});

describe('assertReversible', () => {
    const lines = [d('a', 100), c('b', 100)];

    it('aceita lançamento manual ainda não estornado', () => {
        expect(() => assertReversible(journalFixture('MANUAL', 'm1', lines), false)).not.toThrow();
    });

    it('recusa lançamento automático e estorno de estorno', () => {
        fails('JOURNAL_NOT_REVERSIBLE', () =>
            assertReversible(journalFixture('TITLE_CREATION', 't1', lines), false),
        );
        fails('JOURNAL_NOT_REVERSIBLE', () =>
            assertReversible(journalFixture('MANUAL_REVERSAL', 'm1', lines), false),
        );
    });

    it('recusa lançamento manual já estornado', () => {
        fails('JOURNAL_ALREADY_REVERSED', () =>
            assertReversible(journalFixture('MANUAL', 'm1', lines), true),
        );
    });
});
