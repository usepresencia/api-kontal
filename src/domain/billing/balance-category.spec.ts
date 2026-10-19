import { AccountNature } from '@/domain/billing/account-nature.js';
import { BalanceCategory, balanceCategoryRules } from '@/domain/billing/balance-category.js';

const { ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE } = AccountNature;
const invalid = (fn: () => unknown) => {
    expect(fn).toThrow(expect.objectContaining({ code: 'BALANCE_CATEGORY_INVALID' }));
};

describe('balanceCategoryRules', () => {
    it.each([
        [ASSET, BalanceCategory.CURRENT_ASSET],
        [ASSET, BalanceCategory.NON_CURRENT_ASSET],
        [LIABILITY, BalanceCategory.CURRENT_LIABILITY],
        [LIABILITY, BalanceCategory.NON_CURRENT_LIABILITY],
        [EQUITY, BalanceCategory.EQUITY],
    ])('aceita %s com %s', (nature, category) => {
        expect(() => balanceCategoryRules.assert(nature, category)).not.toThrow();
    });

    it.each([
        [ASSET, BalanceCategory.CURRENT_LIABILITY],
        [LIABILITY, BalanceCategory.EQUITY],
        [EQUITY, BalanceCategory.CURRENT_ASSET],
        [REVENUE, BalanceCategory.CURRENT_ASSET],
        [EXPENSE, BalanceCategory.EQUITY],
    ])('recusa %s com %s', (nature, category) => {
        invalid(() => balanceCategoryRules.assert(nature, category));
    });

    it('padrão: ativo e passivo circulantes, PL; contas de resultado fora do balanço', () => {
        expect(balanceCategoryRules.effective(ASSET, null)).toBe('CURRENT_ASSET');
        expect(balanceCategoryRules.effective(LIABILITY, null)).toBe('CURRENT_LIABILITY');
        expect(balanceCategoryRules.effective(EQUITY, null)).toBe('EQUITY');
        expect(balanceCategoryRules.effective(REVENUE, null)).toBeNull();
    });
});
