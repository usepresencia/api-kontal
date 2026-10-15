import {
    billingPlanBodySchema,
    createBillingAccountSchema,
    listBillingAccountsQuerySchema,
    updateBillingAccountSchema,
} from '@/presentation/billing/billing.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

describe('billingPlanBodySchema', () => {
    it('aceita nome com descrição opcional e apara os textos', () => {
        expect(billingPlanBodySchema.parse({ name: ' Plano ' })).toEqual({ name: 'Plano' });
        expect(billingPlanBodySchema.parse({ name: 'P', description: ' d ' })).toEqual({
            name: 'P',
            description: 'd',
        });
    });

    it.each([
        [{}],
        [{ name: ' ' }],
        [{ name: 'x'.repeat(256) }],
        [{ name: 'P', description: 'x'.repeat(256) }],
    ])('rejeita %j', body => {
        expect(billingPlanBodySchema.safeParse(body).success).toBe(false);
    });
});

describe('createBillingAccountSchema', () => {
    const valid = { billingPlanId: uuid, name: 'Ativo', accountType: 'SYNTHETIC' };

    it('aceita corpo mínimo e com pai nulo ou UUID', () => {
        expect(createBillingAccountSchema.safeParse(valid).success).toBe(true);
        expect(createBillingAccountSchema.safeParse({ ...valid, parentId: null }).success).toBe(
            true,
        );
        expect(createBillingAccountSchema.safeParse({ ...valid, parentId: uuid }).success).toBe(
            true,
        );
    });

    it('aceita a natureza informada e a omissão dela', () => {
        expect(createBillingAccountSchema.parse({ ...valid, nature: 'REVENUE' }).nature).toBe(
            'REVENUE',
        );
        expect(createBillingAccountSchema.parse(valid).nature).toBeUndefined();
    });

    it('aceita as categorias, null e a omissão delas', () => {
        const parsed = createBillingAccountSchema.parse({
            ...valid,
            dreCategory: 'COST_OF_SALES',
            balanceCategory: null,
        });
        expect(parsed).toMatchObject({ dreCategory: 'COST_OF_SALES', balanceCategory: null });
        expect(createBillingAccountSchema.parse(valid).dreCategory).toBeUndefined();
    });

    it.each([
        ['plano que não é UUID', { billingPlanId: 'p1' }],
        ['pai que não é UUID', { parentId: 'abc' }],
        ['tipo desconhecido', { accountType: 'OUTRO' }],
        ['tipo em minúsculas', { accountType: 'analytic' }],
        ['nome vazio', { name: '' }],
        ['isActive que não é booleano', { isActive: 'sim' }],
        ['natureza desconhecida', { nature: 'OUTRA' }],
        ['categoria de DRE desconhecida', { dreCategory: 'OUTRA' }],
        ['categoria de balanço desconhecida', { balanceCategory: 'OUTRA' }],
    ])('rejeita %s', (_label, overrides) => {
        expect(createBillingAccountSchema.safeParse({ ...valid, ...overrides }).success).toBe(
            false,
        );
    });
});

describe('updateBillingAccountSchema', () => {
    it('aceita qualquer subconjunto não vazio de name, isActive e accountType', () => {
        expect(updateBillingAccountSchema.safeParse({ name: 'N' }).success).toBe(true);
        expect(updateBillingAccountSchema.safeParse({ isActive: false }).success).toBe(true);
        expect(updateBillingAccountSchema.safeParse({ accountType: 'ANALYTIC' }).success).toBe(
            true,
        );
    });

    it('aceita só uma categoria, inclusive null para limpar', () => {
        expect(updateBillingAccountSchema.safeParse({ dreCategory: 'INCOME_TAX' }).success).toBe(
            true,
        );
        expect(updateBillingAccountSchema.safeParse({ balanceCategory: null }).success).toBe(true);
        expect(updateBillingAccountSchema.safeParse({ balanceCategory: 'OUTRA' }).success).toBe(
            false,
        );
    });

    it('rejeita corpo vazio e valores inválidos', () => {
        expect(updateBillingAccountSchema.safeParse({}).success).toBe(false);
        expect(updateBillingAccountSchema.safeParse({ name: '' }).success).toBe(false);
        expect(updateBillingAccountSchema.safeParse({ accountType: 'X' }).success).toBe(false);
    });
});

describe('listBillingAccountsQuerySchema', () => {
    it('combina paginação com o filtro opcional de plano', () => {
        expect(listBillingAccountsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
        expect(listBillingAccountsQuerySchema.parse({ planId: uuid, page: '2' })).toEqual({
            planId: uuid,
            page: 2,
            pageSize: 10,
        });
    });

    it('rejeita planId que não é UUID', () => {
        expect(listBillingAccountsQuerySchema.safeParse({ planId: 'x' }).success).toBe(false);
    });
});
