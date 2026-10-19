import { AccountNature } from '@/domain/billing/account-nature.js';
import { DreCategory, dreCategoryRules } from '@/domain/billing/dre-category.js';

const { ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE } = AccountNature;

describe('dreCategoryRules', () => {
    it.each([
        [
            REVENUE,
            [DreCategory.GROSS_REVENUE, DreCategory.FINANCIAL_REVENUE, DreCategory.OTHER_REVENUE],
        ],
        [
            EXPENSE,
            [
                DreCategory.REVENUE_DEDUCTION,
                DreCategory.COST_OF_SALES,
                DreCategory.OPERATING_EXPENSE,
                DreCategory.FINANCIAL_EXPENSE,
                DreCategory.OTHER_EXPENSE,
                DreCategory.INCOME_TAX,
            ],
        ],
    ])('aceita para %s exatamente as categorias do CPC 26', (nature, categories) => {
        for (const category of Object.values(DreCategory)) {
            const call = () => dreCategoryRules.assert(nature, category);
            if (categories.includes(category)) expect(call).not.toThrow();
            else expect(call).toThrow(expect.objectContaining({ code: 'DRE_CATEGORY_INVALID' }));
        }
    });

    it.each([ASSET, LIABILITY, EQUITY])('não aceita categoria de DRE para %s', nature => {
        expect(() => dreCategoryRules.assert(nature, DreCategory.GROSS_REVENUE)).toThrow(
            expect.objectContaining({ code: 'DRE_CATEGORY_INVALID' }),
        );
    });

    it('padrão: receita bruta e despesa operacional; patrimoniais fora do DRE', () => {
        expect(dreCategoryRules.effective(REVENUE, null)).toBe('GROSS_REVENUE');
        expect(dreCategoryRules.effective(EXPENSE, null)).toBe('OPERATING_EXPENSE');
        expect(dreCategoryRules.effective(ASSET, null)).toBeNull();
    });
});
