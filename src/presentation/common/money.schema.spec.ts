import { moneySchema } from '@/presentation/common/money.schema.js';

describe('moneySchema', () => {
    it.each([
        ['1234.50', 123450],
        ['10', 1000],
        ['0.01', 1],
        ['9999999999.99', 999999999999],
    ])('converte %j em %i centavos', (text, cents) => {
        expect(moneySchema.parse(text)).toBe(cents);
    });

    it.each(['1.234', '-1', 'abc', '', '1,50', ' 1', '10000000000', 10, null, undefined])(
        'rejeita %j',
        value => {
            expect(moneySchema.safeParse(value).success).toBe(false);
        },
    );
});
