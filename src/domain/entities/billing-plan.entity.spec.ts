import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import { DomainError } from '@/domain/errors/domain-error.js';

describe('BillingPlanEntity', () => {
    it('cria aparando os textos e com descrição vazia por padrão', () => {
        const plan = BillingPlanEntity.create({ id: 'p1', companyId: 'c1', name: '  Plano ' });
        expect(plan).toMatchObject({ id: 'p1', companyId: 'c1', name: 'Plano', description: '' });
    });

    it('guarda a descrição aparada', () => {
        const plan = BillingPlanEntity.create({
            id: 'p1',
            companyId: 'c1',
            name: 'Plano',
            description: ' Plano padrão ',
        });
        expect(plan.description).toBe('Plano padrão');
    });

    it.each([
        ['nome vazio', { name: '' }],
        ['nome acima de 255', { name: 'x'.repeat(256) }],
        ['descrição acima de 255', { description: 'x'.repeat(256) }],
    ])('rejeita %s', (_label, overrides) => {
        expect(() =>
            BillingPlanEntity.create({ id: 'p1', companyId: 'c1', name: 'Plano', ...overrides }),
        ).toThrow(DomainError);
    });

    it('exige companyId', () => {
        expect(() => BillingPlanEntity.create({ id: 'p1', companyId: '', name: 'Plano' })).toThrow(
            DomainError,
        );
    });

    it('withChanges revalida e preserva id, empresa e criação', () => {
        const plan = BillingPlanEntity.create({ id: 'p1', companyId: 'c1', name: 'Plano' });
        const changed = plan.withChanges({ name: 'Novo', description: 'desc' });
        expect(changed).toMatchObject({
            id: 'p1',
            companyId: 'c1',
            name: 'Novo',
            description: 'desc',
        });
        expect(changed.createdAt).toBe(plan.createdAt);
        expect(() => plan.withChanges({ name: '' })).toThrow(DomainError);
    });

    it('fromPersistence reidrata sem revalidar', () => {
        const createdAt = new Date('2026-01-01');
        const plan = BillingPlanEntity.fromPersistence({
            id: 'p9',
            companyId: 'c9',
            name: 'N',
            description: 'D',
            createdAt,
        });
        expect(plan.createdAt).toBe(createdAt);
    });
});
