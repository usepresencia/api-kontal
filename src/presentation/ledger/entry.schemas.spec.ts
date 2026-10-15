import {
    createEntrySchema,
    listEntriesQuerySchema,
    updateEntrySchema,
} from '@/presentation/ledger/entry.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const valid = {
    billingAccountId: uuid,
    principalAmount: '1000.00',
    paidAt: '2026-10-10',
    paymentMethod: 'PIX',
};

describe('createEntrySchema', () => {
    it('converte valores em centavos e a data; encargos são opcionais', () => {
        const parsed = createEntrySchema.parse({
            ...valid,
            interestAmount: '50.00',
            fineAmount: '20.00',
            discountAmount: '30.00',
            description: ' Pix ',
        });
        expect(parsed).toMatchObject({
            billingAccountId: uuid,
            principalAmount: 100000,
            interestAmount: 5000,
            fineAmount: 2000,
            discountAmount: 3000,
            paidAt: new Date('2026-10-10T00:00:00.000Z'),
            paymentMethod: 'PIX',
            description: 'Pix',
        });
        expect(createEntrySchema.parse(valid).interestAmount).toBeUndefined();
    });

    it.each([
        ['conta que não é UUID', { billingAccountId: 'x' }],
        ['principal com 3 casas', { principalAmount: '1.234' }],
        ['juros numérico', { interestAmount: 5 }],
        ['data inválida', { paidAt: '10/10/2026' }],
        ['forma de pagamento desconhecida', { paymentMethod: 'BOLETO' }],
        ['forma em minúsculas', { paymentMethod: 'pix' }],
        ['sem forma de pagamento', { paymentMethod: undefined }],
        ['descrição acima de 255', { description: 'x'.repeat(256) }],
    ])('rejeita %s', (_label, overrides) => {
        expect(createEntrySchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
    });
});

describe('updateEntrySchema', () => {
    it('aceita descrição e forma de pagamento e exige ao menos um campo', () => {
        expect(updateEntrySchema.safeParse({ description: 'x' }).success).toBe(true);
        expect(updateEntrySchema.safeParse({ paymentMethod: 'CASH' }).success).toBe(true);
        expect(updateEntrySchema.safeParse({}).success).toBe(false);
        expect(updateEntrySchema.safeParse({ paymentMethod: 'X' }).success).toBe(false);
    });
});

describe('listEntriesQuerySchema', () => {
    it('combina paginação com o filtro de título', () => {
        expect(listEntriesQuerySchema.parse({ titleId: uuid })).toEqual({
            titleId: uuid,
            page: 1,
            pageSize: 10,
        });
        expect(listEntriesQuerySchema.safeParse({ titleId: 'x' }).success).toBe(false);
    });
});

describe('listEntriesQuerySchema: filtros do bloco 5', () => {
    it('converte o período de pagamento e aceita tipo do título e conta', () => {
        expect(
            listEntriesQuerySchema.parse({
                paidFrom: '2026-10-01',
                paidTo: '2026-10-31',
                titleType: 'INCOME',
                billingAccountId: uuid,
            }),
        ).toEqual({
            paidFrom: new Date('2026-10-01T00:00:00.000Z'),
            paidTo: new Date('2026-10-31T00:00:00.000Z'),
            titleType: 'INCOME',
            billingAccountId: uuid,
            page: 1,
            pageSize: 10,
        });
    });

    it.each([
        { paidFrom: 'ontem' },
        { paidTo: '31/10/2026' },
        { titleType: 'OUTRO' },
        { billingAccountId: 'x' },
    ])('rejeita %j', query => {
        expect(listEntriesQuerySchema.safeParse(query).success).toBe(false);
    });
});
