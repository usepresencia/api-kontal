import { formatMoney, MONEY_PATTERN, parseMoney } from '@/domain/money.js';

describe('parseMoney', () => {
    it.each([
        ['1234.50', 123450],
        ['1234.5', 123450],
        ['10', 1000],
        ['0.01', 1],
        ['0', 0],
        ['9999999999.99', 999999999999],
    ])('converte %j em %i centavos', (raw, cents) => {
        expect(parseMoney(raw)).toBe(cents);
    });

    it.each(['1.234', '-1', 'abc', '', '1,50', ' 1', '1 ', '10000000000', '.5', '1.'])(
        'rejeita %j com VALIDATION_ERROR',
        raw => {
            expect(() => parseMoney(raw)).toThrow(
                expect.objectContaining({ code: 'VALIDATION_ERROR' }),
            );
        },
    );

    it('cita o rótulo na mensagem', () => {
        expect(() => parseMoney('x', 'Desconto')).toThrow(/Desconto/);
    });

    it('expõe o padrão usado para validar a entrada da API', () => {
        expect(MONEY_PATTERN.test('12.34')).toBe(true);
        expect(MONEY_PATTERN.test('12.345')).toBe(false);
    });
});

describe('formatMoney', () => {
    it.each([
        [123450, '1234.50'],
        [5, '0.05'],
        [0, '0.00'],
        [100, '1.00'],
        [999999999999, '9999999999.99'],
    ])('%i centavos → %j', (cents, text) => {
        expect(formatMoney(cents)).toBe(text);
    });

    it.each([-1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2])('rejeita %s', cents => {
        expect(() => formatMoney(cents)).toThrow(
            expect.objectContaining({ code: 'INTERNAL_ERROR' }),
        );
    });
});
