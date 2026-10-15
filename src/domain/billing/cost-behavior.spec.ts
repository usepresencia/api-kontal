import { AccountNature } from '@/domain/billing/account-nature.js';
import { CostBehavior, costBehaviorRules } from '@/domain/billing/cost-behavior.js';

const { ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE } = AccountNature;

describe('costBehaviorRules', () => {
    it.each(Object.values(CostBehavior))('aceita %s em despesa', behavior => {
        expect(() => costBehaviorRules.assert(EXPENSE, behavior)).not.toThrow();
    });

    it.each([ASSET, LIABILITY, EQUITY, REVENUE])('recusa comportamento de custo em %s', nature => {
        expect(() => costBehaviorRules.assert(nature, CostBehavior.FIXED)).toThrow(
            expect.objectContaining({ code: 'COST_BEHAVIOR_INVALID' }),
        );
    });

    it('sem comportamento sempre vale e não há padrão por natureza', () => {
        expect(() => costBehaviorRules.assert(ASSET, null)).not.toThrow();
        expect(costBehaviorRules.effective(EXPENSE, null)).toBeNull();
        expect(costBehaviorRules.effective(EXPENSE, CostBehavior.VARIABLE)).toBe('VARIABLE');
    });
});
