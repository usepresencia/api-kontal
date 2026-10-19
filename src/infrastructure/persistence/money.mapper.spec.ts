import { signedCents, toCents, toDecimal } from '@/infrastructure/persistence/money.mapper.js';

describe('money.mapper', () => {
    it('toCents converte o Decimal do banco em centavos inteiros', () => {
        expect(toCents({ toFixed: () => '1234.50' })).toBe(123450);
        expect(toCents({ toFixed: () => '0.05' })).toBe(5);
        expect(toCents({ toFixed: () => '0.00' })).toBe(0);
    });

    it('toCents pede 2 casas ao Decimal', () => {
        const toFixed = vi.fn().mockReturnValue('1.00');
        toCents({ toFixed });
        expect(toFixed).toHaveBeenCalledWith(2);
    });

    it('toDecimal devolve o Decimal com 2 casas exatas', () => {
        expect(toDecimal(123450).toFixed(2)).toBe('1234.50');
        expect(toDecimal(5).toFixed(2)).toBe('0.05');
    });
});

describe('signedCents', () => {
    it.each([
        ['12.50', 1250],
        ['-12.50', -1250],
        ['0', 0],
        ['-0.05', -5],
    ])('%s → %i', (text, cents) => {
        expect(signedCents(text)).toBe(cents);
    });
});
