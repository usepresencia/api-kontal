import {
    createPresetSchema,
    listPresetsQuerySchema,
    updatePresetSchema,
} from '@/presentation/ledger/preset.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const valid = {
    billingPlanId: uuid,
    name: ' Venda ',
    accounts: { receivable: uuid, payable: uuid, revenue: uuid },
};

describe('createPresetSchema', () => {
    it('aceita o corpo mínimo, apara o nome e aceita papéis opcionais nulos', () => {
        const parsed = createPresetSchema.parse({
            ...valid,
            accounts: { ...valid.accounts, expense: null, interestIncome: uuid },
        });
        expect(parsed.name).toBe('Venda');
        expect(parsed.accounts.expense).toBeNull();
        expect(parsed.accounts.interestIncome).toBe(uuid);
    });

    it.each([
        ['plano que não é UUID', { billingPlanId: 'p1' }],
        ['nome vazio', { name: ' ' }],
        ['descrição acima de 255', { description: 'x'.repeat(256) }],
        ['isActive que não é booleano', { isActive: 'sim' }],
        ['sem contas', { accounts: undefined }],
        ['sem conta a receber', { accounts: { payable: uuid } }],
        ['conta que não é UUID', { accounts: { ...valid.accounts, revenue: 'x' } }],
    ])('rejeita %s', (_label, overrides) => {
        expect(createPresetSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
    });
});

describe('updatePresetSchema', () => {
    it('não aceita trocar o plano (campo ignorado) e exige as contas obrigatórias', () => {
        const parsed = updatePresetSchema.parse({ ...valid });
        expect('billingPlanId' in parsed).toBe(false);
        expect(updatePresetSchema.safeParse({ name: 'x' }).success).toBe(false);
    });
});

describe('listPresetsQuerySchema', () => {
    it('combina paginação com filtros e converte isActive', () => {
        expect(listPresetsQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
        expect(
            listPresetsQuerySchema.parse({ billingPlanId: uuid, isActive: 'false', page: '2' }),
        ).toEqual({
            billingPlanId: uuid,
            isActive: false,
            page: 2,
            pageSize: 10,
        });
        expect(listPresetsQuerySchema.parse({ isActive: 'true' }).isActive).toBe(true);
    });

    it('rejeita plano que não é UUID e isActive inválido', () => {
        expect(listPresetsQuerySchema.safeParse({ billingPlanId: 'x' }).success).toBe(false);
        expect(listPresetsQuerySchema.safeParse({ isActive: 'talvez' }).success).toBe(false);
    });
});

describe('createPresetSchema: openingBalance', () => {
    it('openingBalance é opcional, aceita null e exige UUID', () => {
        const body = {
            billingPlanId: uuid,
            name: 'P',
            accounts: { receivable: uuid, payable: uuid },
        };
        expect(createPresetSchema.parse(body).accounts.openingBalance).toBeUndefined();
        expect(
            createPresetSchema.parse({
                ...body,
                accounts: { ...body.accounts, openingBalance: null },
            }).accounts.openingBalance,
        ).toBeNull();
        expect(
            createPresetSchema.safeParse({
                ...body,
                accounts: { ...body.accounts, openingBalance: 'x' },
            }).success,
        ).toBe(false);
    });
});
