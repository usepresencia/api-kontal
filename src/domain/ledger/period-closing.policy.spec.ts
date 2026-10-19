import { AccountNature } from '@/domain/billing/account-nature.js';
import type { AccountRef } from '@/domain/billing/account-ref.js';
import { AccountType } from '@/domain/billing/account-type.js';
import {
    assertClosableMonth,
    assertRetainedAccount,
    assertRetainedInput,
    isDecember,
    monthEnd,
    monthOf,
} from '@/domain/ledger/period-closing.policy.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const today = day('2026-10-14');
const failing = (code: string, fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code }));
};

describe('helpers de mês', () => {
    it('monthEnd devolve o último dia, inclusive fevereiro de ano bissexto', () => {
        expect(monthEnd('2026-09')).toEqual(day('2026-09-30'));
        expect(monthEnd('2026-12')).toEqual(day('2026-12-31'));
        expect(monthEnd('2028-02')).toEqual(day('2028-02-29'));
        expect(monthEnd('2027-02')).toEqual(day('2027-02-28'));
    });

    it('monthOf e isDecember', () => {
        expect(monthOf(day('2026-09-30'))).toBe('2026-09');
        expect(isDecember('2026-12')).toBe(true);
        expect(isDecember('2026-11')).toBe(false);
    });
});

describe('assertClosableMonth', () => {
    const base = { today, closedThrough: null, earliestLedgerDate: day('2026-03-10') };

    it('primeiro fechamento: o mês do lançamento mais antigo, já encerrado', () => {
        expect(assertClosableMonth({ ...base, month: '2026-03' })).toEqual(day('2026-03-31'));
        failing('PERIOD_CLOSING_INVALID', () => assertClosableMonth({ ...base, month: '2026-04' }));
        failing('PERIOD_CLOSING_INVALID', () => assertClosableMonth({ ...base, month: '2026-02' }));
    });

    it('sem lançamentos qualquer mês encerrado serve', () => {
        expect(
            assertClosableMonth({ ...base, earliestLedgerDate: null, month: '2026-07' }),
        ).toEqual(day('2026-07-31'));
    });

    it('seguintes: exatamente o mês depois do último fechado, inclusive na virada do ano', () => {
        expect(
            assertClosableMonth({ ...base, closedThrough: day('2026-03-31'), month: '2026-04' }),
        ).toEqual(day('2026-04-30'));
        expect(
            assertClosableMonth({ ...base, closedThrough: day('2025-12-31'), month: '2026-01' }),
        ).toEqual(day('2026-01-31'));
        failing('PERIOD_CLOSING_INVALID', () =>
            assertClosableMonth({ ...base, closedThrough: day('2026-03-31'), month: '2026-05' }),
        );
        failing('PERIOD_CLOSING_INVALID', () =>
            assertClosableMonth({ ...base, closedThrough: day('2026-03-31'), month: '2026-03' }),
        );
    });

    it('mês não encerrado (o corrente ou futuro) é recusado; o último dia vira "encerrado" no dia seguinte', () => {
        failing('PERIOD_CLOSING_INVALID', () =>
            assertClosableMonth({
                ...base,
                earliestLedgerDate: day('2026-10-01'),
                month: '2026-10',
            }),
        );
        failing('PERIOD_CLOSING_INVALID', () =>
            assertClosableMonth({ ...base, earliestLedgerDate: null, month: '2027-01' }),
        );
        expect(
            assertClosableMonth({
                ...base,
                today: day('2026-10-01'),
                earliestLedgerDate: day('2026-09-10'),
                month: '2026-09',
            }),
        ).toEqual(day('2026-09-30'));
        failing('PERIOD_CLOSING_INVALID', () =>
            assertClosableMonth({
                ...base,
                today: day('2026-09-30'),
                earliestLedgerDate: day('2026-09-10'),
                month: '2026-09',
            }),
        );
    });
});

describe('assertRetainedInput', () => {
    it('dezembro exige a conta; os demais meses não aceitam', () => {
        expect(() => assertRetainedInput('2026-12', 'ret')).not.toThrow();
        expect(() => assertRetainedInput('2026-11', undefined)).not.toThrow();
        failing('RETAINED_EARNINGS_ACCOUNT_INVALID', () =>
            assertRetainedInput('2026-12', undefined),
        );
        failing('PERIOD_CLOSING_INVALID', () => assertRetainedInput('2026-11', 'ret'));
    });
});

describe('assertRetainedAccount', () => {
    const ref = (overrides: Partial<AccountRef> = {}): AccountRef => ({
        id: 'ret',
        billingPlanId: 'p1',
        accountType: AccountType.ANALYTIC,
        nature: AccountNature.EQUITY,
        isActive: true,
        ...overrides,
    });

    it('aceita conta de patrimônio líquido analítica, ativa e do plano', () => {
        expect(() => assertRetainedAccount('p1', ref())).not.toThrow();
    });

    it.each([
        ['inexistente', undefined],
        ['de outro plano', ref({ billingPlanId: 'p2' })],
        ['sintética', ref({ accountType: AccountType.SYNTHETIC })],
        ['inativa', ref({ isActive: false })],
        ['de ativo', ref({ nature: AccountNature.ASSET })],
    ])('recusa conta %s', (_label, candidate) => {
        failing('RETAINED_EARNINGS_ACCOUNT_INVALID', () => assertRetainedAccount('p1', candidate));
    });
});
