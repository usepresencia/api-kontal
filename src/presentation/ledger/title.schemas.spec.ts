import {
    createTitleSchema,
    listTitlesQuerySchema,
    updateTitleSchema,
    writeOffSchema,
} from '@/presentation/ledger/title.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const valid = {
    presetId: uuid,
    type: 'INCOME',
    description: ' Venda ',
    amount: '1000.50',
    expirationDate: '2026-11-01',
};

describe('createTitleSchema', () => {
    it('aceita o corpo mínimo, converte valor e datas e apara a descrição', () => {
        const parsed = createTitleSchema.parse(valid);
        expect(parsed).toMatchObject({
            presetId: uuid,
            type: 'INCOME',
            description: 'Venda',
            amount: 100050,
            expirationDate: new Date('2026-11-01T00:00:00.000Z'),
        });
        expect(parsed.issueDate).toBeUndefined();
    });

    it('aceita emissão e juros mensais com até 2 casas', () => {
        const parsed = createTitleSchema.parse({
            ...valid,
            issueDate: '2026-10-01',
            feesPercentageMonthly: 0.05,
        });
        expect(parsed.issueDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
        expect(parsed.feesPercentageMonthly).toBe(0.05);
    });

    it.each([
        ['preset que não é UUID', { presetId: 'x' }],
        ['tipo desconhecido', { type: 'OUTRO' }],
        ['tipo em minúsculas', { type: 'income' }],
        ['descrição vazia', { description: ' ' }],
        ['valor com 3 casas', { amount: '10.123' }],
        ['valor numérico', { amount: 10 }],
        ['vencimento inválido', { expirationDate: '01/11/2026' }],
        ['juros negativos', { feesPercentageMonthly: -0.1 }],
        ['juros acima de 1', { feesPercentageMonthly: 1.5 }],
        ['juros com 3 casas', { feesPercentageMonthly: 0.123 }],
    ])('rejeita %s', (_label, overrides) => {
        expect(createTitleSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
    });
});

describe('updateTitleSchema', () => {
    it('aceita campos editáveis e os travados (para o domínio recusar se mudarem)', () => {
        const parsed = updateTitleSchema.parse({
            description: 'Novo',
            expirationDate: '2026-12-01',
            feesPercentageMonthly: 0.1,
            type: 'INCOME',
            amount: '1000.50',
            presetId: uuid,
            issueDate: '2026-10-01',
        });
        expect(parsed.amount).toBe(100050);
        expect(parsed.issueDate).toEqual(new Date('2026-10-01T00:00:00.000Z'));
    });

    it('aceita corpo vazio e rejeita valores inválidos', () => {
        expect(updateTitleSchema.safeParse({}).success).toBe(true);
        expect(updateTitleSchema.safeParse({ description: '' }).success).toBe(false);
        expect(updateTitleSchema.safeParse({ amount: '1.234' }).success).toBe(false);
    });
});

describe('writeOffSchema', () => {
    it('aceita corpo vazio, data e descrição', () => {
        expect(writeOffSchema.parse({})).toEqual({});
        expect(writeOffSchema.parse({ paidAt: '2026-10-10', description: ' x ' })).toEqual({
            paidAt: new Date('2026-10-10T00:00:00.000Z'),
            description: 'x',
        });
        expect(writeOffSchema.safeParse({ paidAt: 'ontem' }).success).toBe(false);
    });
});

describe('listTitlesQuerySchema', () => {
    it('combina paginação com filtros e converte os vencimentos', () => {
        expect(listTitlesQuerySchema.parse({})).toEqual({ page: 1, pageSize: 10 });
        expect(
            listTitlesQuerySchema.parse({
                type: 'EXPENSE',
                status: 'OPEN',
                presetId: uuid,
                seriesId: uuid,
                dueFrom: '2026-10-01',
                dueTo: '2026-10-31',
            }),
        ).toMatchObject({
            type: 'EXPENSE',
            status: 'OPEN',
            presetId: uuid,
            seriesId: uuid,
            dueFrom: new Date('2026-10-01T00:00:00.000Z'),
            dueTo: new Date('2026-10-31T00:00:00.000Z'),
        });
    });

    it.each([
        { type: 'X' },
        { status: 'ABERTO' },
        { presetId: 'x' },
        { seriesId: 'x' },
        { dueFrom: 'x' },
    ])('rejeita %j', query => {
        expect(listTitlesQuerySchema.safeParse(query).success).toBe(false);
    });
});
