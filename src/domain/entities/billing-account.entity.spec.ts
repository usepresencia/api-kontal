import { AccountType } from '@/domain/billing/account-type.js';
import { BillingAccountEntity } from '@/domain/entities/billing-account.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

const draftParams = {
    id: 'a1',
    billingPlanId: 'p1',
    parentId: null,
    name: ' Ativo ',
    accountType: AccountType.SYNTHETIC,
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
});
