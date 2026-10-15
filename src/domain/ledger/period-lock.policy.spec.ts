import {
    assertPaymentDateOpen,
    assertPeriodOpen,
    LOCK_EXEMPT_TYPES,
} from '@/domain/ledger/period-lock.policy.js';

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const closed = (fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code: 'PERIOD_CLOSED' }));
};

describe('assertPeriodOpen', () => {
    it('sem fechamento qualquer data passa', () => {
        expect(() => assertPeriodOpen(null, [day('2020-01-01')])).not.toThrow();
    });

    it('aceita só datas depois da trava (a data da trava ainda é fechada)', () => {
        expect(() =>
            assertPeriodOpen(day('2026-09-30'), [day('2026-10-01'), day('2026-12-01')]),
        ).not.toThrow();
        closed(() => assertPeriodOpen(day('2026-09-30'), [day('2026-10-01'), day('2026-09-30')]));
        closed(() => assertPeriodOpen(day('2026-09-30'), [day('2026-01-15')]));
    });

    it('a mensagem traz a data da trava em formato brasileiro', () => {
        expect(() => assertPeriodOpen(day('2026-09-30'), [day('2026-09-01')])).toThrow(
            /30\/09\/2026/,
        );
    });

    it('sem datas nada a verificar', () => {
        expect(() => assertPeriodOpen(day('2026-09-30'), [])).not.toThrow();
    });
});

describe('assertPaymentDateOpen', () => {
    it('baixa paga até a data da trava não pode ser excluída', () => {
        closed(() => assertPaymentDateOpen(day('2026-09-30'), day('2026-09-30')));
        closed(() => assertPaymentDateOpen(day('2026-09-01'), day('2026-09-30')));
        expect(() => assertPaymentDateOpen(day('2026-10-01'), day('2026-09-30'))).not.toThrow();
        expect(() => assertPaymentDateOpen(day('2020-01-01'), null)).not.toThrow();
    });
});

describe('LOCK_EXEMPT_TYPES', () => {
    it('só a apuração e o estorno dela ficam fora da trava', () => {
        expect([...LOCK_EXEMPT_TYPES]).toEqual(['CLOSING', 'CLOSING_REVERSAL']);
    });
});
