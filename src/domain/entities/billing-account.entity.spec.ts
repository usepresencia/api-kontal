import { AccountNature } from '@/domain/billing/account-nature.js';
import { AccountType } from '@/domain/billing/account-type.js';
import { CostBehavior } from '@/domain/billing/cost-behavior.js';
import { BalanceCategory } from '@/domain/billing/balance-category.js';
import { DreCategory } from '@/domain/billing/dre-category.js';
import { BillingAccountEntity } from '@/domain/entities/billing-account.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const draftParams = {
    id: 'a1',
    billingPlanId: 'p1',
    parentId: null,
    name: ' Ativo ',
    accountType: AccountType.SYNTHETIC,
    nature: AccountNature.ASSET,
    dreCategory: null,
    balanceCategory: null,
    costBehavior: null,
    level: 1,
};

describe('BillingAccountEntity.draft', () => {
    it('apara o nome e assume ativa por padrão', () => {
        expect(BillingAccountEntity.draft(draftParams)).toMatchObject({
            id: 'a1',
            name: 'Ativo',
            isActive: true,
            level: 1,
            parentId: null,
            nature: 'ASSET',
            dreCategory: null,
            balanceCategory: null,
            costBehavior: null,
        });
    });

    it('respeita isActive informado', () => {
        expect(BillingAccountEntity.draft({ ...draftParams, isActive: false }).isActive).toBe(
            false,
        );
    });

    it('rejeita nome vazio', () => {
        expect(() => BillingAccountEntity.draft({ ...draftParams, name: ' ' })).toThrow(
            DomainError,
        );
    });
});

describe('BillingAccountEntity', () => {
    const account = BillingAccountEntity.fromPersistence({
        id: 'a1',
        billingPlanId: 'p1',
        parentId: 'a0',
        name: 'Caixa',
        accountType: AccountType.ANALYTIC,
        nature: AccountNature.LIABILITY,
        dreCategory: null,
        balanceCategory: null,
        costBehavior: null,
        isActive: true,
        code: '1.1',
        level: 2,
        createdAt: new Date('2026-01-01'),
    });

    it('withChanges altera nome, status e tipo e preserva código, nível e vínculos', () => {
        const changed = account.withChanges({
            name: ' Banco ',
            isActive: false,
            accountType: AccountType.SYNTHETIC,
        });
        expect(changed).toMatchObject({
            name: 'Banco',
            isActive: false,
            accountType: 'SYNTHETIC',
            nature: 'LIABILITY',
            code: '1.1',
            level: 2,
            parentId: 'a0',
            billingPlanId: 'p1',
        });
    });

    it('withChanges sem campos mantém tudo', () => {
        expect(account.withChanges({})).toMatchObject({ name: 'Caixa', isActive: true });
    });

    it('withChanges rejeita nome vazio', () => {
        expect(() => account.withChanges({ name: '' })).toThrow(DomainError);
    });

    it('withChanges troca ou limpa as categorias compatíveis com a natureza', () => {
        const changed = account.withChanges({
            balanceCategory: BalanceCategory.NON_CURRENT_LIABILITY,
        });
        expect(changed.balanceCategory).toBe('NON_CURRENT_LIABILITY');
        expect(changed.withChanges({ balanceCategory: null }).balanceCategory).toBeNull();
        expect(account.withChanges({}).dreCategory).toBeNull();
    });

    it('withChanges recusa categoria incompatível com a natureza', () => {
        expect(() => account.withChanges({ dreCategory: DreCategory.GROSS_REVENUE })).toThrow(
            expect.objectContaining({ code: 'DRE_CATEGORY_INVALID' }),
        );
        expect(() =>
            account.withChanges({ balanceCategory: BalanceCategory.CURRENT_ASSET }),
        ).toThrow(expect.objectContaining({ code: 'BALANCE_CATEGORY_INVALID' }));
    });

    it('withChanges troca ou limpa o comportamento de custo em despesa e recusa em outras naturezas', () => {
        const expense = BillingAccountEntity.fromPersistence({
            id: 'e1',
            billingPlanId: 'p1',
            parentId: 'a0',
            name: 'Aluguel',
            accountType: AccountType.ANALYTIC,
            nature: AccountNature.EXPENSE,
            dreCategory: null,
            balanceCategory: null,
            costBehavior: null,
            isActive: true,
            code: '4.1',
            level: 2,
            createdAt: new Date('2026-01-01'),
        });
        const fixed = expense.withChanges({ costBehavior: CostBehavior.FIXED });
        expect(fixed.costBehavior).toBe('FIXED');
        expect(fixed.withChanges({ costBehavior: null }).costBehavior).toBeNull();
        expect(fixed.withChanges({}).costBehavior).toBe('FIXED');
        expect(() => account.withChanges({ costBehavior: CostBehavior.VARIABLE })).toThrow(
            expect.objectContaining({ code: 'COST_BEHAVIOR_INVALID' }),
        );
    });
});
