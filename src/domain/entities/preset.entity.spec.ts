import { PresetEntity } from '@/domain/entities/preset.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';
import type { PresetAccountIds } from '@/domain/ledger/preset-roles.js';

const accounts: Partial<PresetAccountIds> = {
    receivable: 'ar',
    payable: 'ap',
    revenue: 'rev',
    expense: 'exp',
};

const create = (overrides: Record<string, unknown> = {}) =>
    PresetEntity.create({
        id: 'pr1',
        billingPlanId: 'p1',
        name: ' Venda de serviços ',
        accounts,
        ...overrides,
    });

describe('PresetEntity.create', () => {
    it('apara os textos, assume ativo e completa os papéis opcionais com null', () => {
        const preset = create();
        expect(preset).toMatchObject({
            id: 'pr1',
            billingPlanId: 'p1',
            name: 'Venda de serviços',
            description: '',
            isActive: true,
        });
        expect(preset.accounts).toEqual({
            receivable: 'ar',
            payable: 'ap',
            revenue: 'rev',
            expense: 'exp',
            interestIncome: null,
            discountGranted: null,
            badDebt: null,
            interestExpense: null,
            discountObtained: null,
            debtForgiveness: null,
            openingBalance: null,
        });
    });

    it('respeita descrição e isActive informados', () => {
        const preset = create({ description: ' x ', isActive: false });
        expect(preset).toMatchObject({ description: 'x', isActive: false });
    });

    it.each([
        ['nome vazio', { name: ' ' }],
        ['nome acima de 255', { name: 'x'.repeat(256) }],
        ['descrição acima de 255', { description: 'x'.repeat(256) }],
        ['sem conta a receber', { accounts: { ...accounts, receivable: null } }],
        ['sem conta a pagar', { accounts: { ...accounts, payable: undefined } }],
    ])('rejeita %s', (_label, overrides) => {
        expect(() => create(overrides)).toThrow(DomainError);
    });

    it('lista os ids das contas usadas, sem repetição de nulos', () => {
        expect(create().accountIds().sort()).toEqual(['ap', 'ar', 'exp', 'rev']);
    });
});

describe('PresetEntity.withChanges', () => {
    it('substitui nome, descrição, status e contas e preserva id, plano e criação', () => {
        const original = create();
        const changed = original.withChanges({
            name: 'Novo',
            description: 'd',
            isActive: false,
            accounts: { ...accounts, interestIncome: 'jr' },
        });
        expect(changed).toMatchObject({
            id: 'pr1',
            billingPlanId: 'p1',
            name: 'Novo',
            description: 'd',
            isActive: false,
            createdAt: original.createdAt,
        });
        expect(changed.accounts.interestIncome).toBe('jr');
    });

    it('mantém o status quando isActive não é informado', () => {
        expect(create({ isActive: false }).withChanges({ name: 'N', accounts }).isActive).toBe(
            false,
        );
    });

    it('revalida', () => {
        expect(() => create().withChanges({ name: '', accounts })).toThrow(DomainError);
    });
});

describe('PresetEntity.fromPersistence', () => {
    it('reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const preset = PresetEntity.fromPersistence({
            id: 'pr9',
            billingPlanId: 'p9',
            name: 'N',
            description: '',
            isActive: true,
            accounts: { ...create().accounts },
            createdAt,
        });
        expect(preset.createdAt).toBe(createdAt);
    });
});
