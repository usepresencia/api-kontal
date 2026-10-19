import { BillingPlanEntity } from '@/domain/entities/billing-plan.entity.js';
import { toAccountResponse, toPlanResponse } from '@/presentation/billing/billing.mapper.js';
import { accountFixture } from '@test/support/billing-fakes.js';

describe('toPlanResponse', () => {
    it('devolve o plano em camelCase com criação em ISO', () => {
        const plan = BillingPlanEntity.create({
            id: 'p1',
            companyId: 'c1',
            name: 'Plano',
            description: 'desc',
            createdAt: new Date('2026-10-14T12:00:00.000Z'),
        });
        expect(toPlanResponse(plan)).toEqual({
            id: 'p1',
            name: 'Plano',
            description: 'desc',
            isDefault: false,
            createdAt: '2026-10-14T12:00:00.000Z',
        });
    });
});

describe('toAccountResponse', () => {
    it('devolve a conta com código, nível e nomes do pai e do plano', () => {
        const view = {
            account: accountFixture({ id: 'a1', parentId: 'a0', code: '1.1', level: 2 }),
            parentName: 'Ativo',
            billingPlanName: 'Plano',
        };
        expect(toAccountResponse(view)).toEqual({
            id: 'a1',
            name: 'Ativo',
            code: '1.1',
            level: 2,
            accountType: 'SYNTHETIC',
            nature: 'ASSET',
            dreCategory: null,
            balanceCategory: null,
            costBehavior: null,
            isActive: true,
            billingPlanId: 'p1',
            billingPlanName: 'Plano',
            parentId: 'a0',
            parentName: 'Ativo',
            createdAt: '2026-01-01T00:00:00.000Z',
        });
    });
});
