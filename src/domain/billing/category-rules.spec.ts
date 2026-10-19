import { AccountNature } from '@/domain/billing/account-nature.js';
import { categoryRules } from '@/domain/billing/category-rules.js';

const rules = categoryRules<'A' | 'B' | 'X'>({
    allowed: {
        ASSET: ['A', 'B'],
        LIABILITY: [],
        EQUITY: [],
        REVENUE: ['X'],
        EXPENSE: [],
    },
    defaults: { ASSET: 'A' },
    errorCode: 'DRE_CATEGORY_INVALID',
    label: 'categoria de teste',
});
const invalid = (fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code: 'DRE_CATEGORY_INVALID' }));
};

describe('categoryRules.assert', () => {
    it('aceita categoria permitida para a natureza e ausência de categoria', () => {
        expect(() => rules.assert(AccountNature.ASSET, 'B')).not.toThrow();
        expect(() => rules.assert(AccountNature.LIABILITY, null)).not.toThrow();
    });

    it('recusa categoria de outra natureza com o código e o rótulo informados', () => {
        invalid(() => rules.assert(AccountNature.REVENUE, 'A'));
        expect(() => rules.assert(AccountNature.EXPENSE, 'X')).toThrow(/categoria de teste X/);
    });
});

describe('categoryRules.resolve', () => {
    it('omitida herda a do pai; informada vence; null explícito deixa sem categoria', () => {
        expect(rules.resolve(AccountNature.ASSET, 'B', undefined)).toBe('B');
        expect(rules.resolve(AccountNature.ASSET, null, undefined)).toBeNull();
        expect(rules.resolve(AccountNature.ASSET, 'B', 'A')).toBe('A');
        expect(rules.resolve(AccountNature.ASSET, 'B', null)).toBeNull();
    });

    it('recusa categoria incompatível, informada ou herdada', () => {
        invalid(() => rules.resolve(AccountNature.REVENUE, null, 'A'));
        invalid(() => rules.resolve(AccountNature.REVENUE, 'A', undefined));
    });
});

describe('categoryRules.effective', () => {
    it('usa a categoria da conta, senão o padrão da natureza, senão null', () => {
        expect(rules.effective(AccountNature.ASSET, 'B')).toBe('B');
        expect(rules.effective(AccountNature.ASSET, null)).toBe('A');
        expect(rules.effective(AccountNature.REVENUE, null)).toBeNull();
    });
});
