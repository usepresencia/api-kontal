import {
    createSeriesSchema,
    extendSeriesSchema,
    listSeriesQuerySchema,
} from '@/presentation/ledger/series.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';
const valid = {
    kind: 'INSTALLMENT',
    presetId: uuid,
    type: 'INCOME',
    description: 'Venda',
    amount: '900.00',
    expirationDate: '2026-11-10',
    count: 3,
};

describe('createSeriesSchema', () => {
    it('aceita parcelado e converte valor e datas', () => {
        expect(createSeriesSchema.parse(valid)).toMatchObject({
            kind: 'INSTALLMENT',
            amount: 90000,
            count: 3,
            expirationDate: new Date('2026-11-10T00:00:00.000Z'),
        });
    });

    it('aceita recorrente com frequência e data final', () => {
        const parsed = createSeriesSchema.parse({
            ...valid,
            kind: 'RECURRING',
            count: undefined,
            until: '2027-01-10',
            frequency: 'WEEKLY',
            issueDate: '2026-10-14',
            feesPercentageMonthly: 0.02,
        });
        expect(parsed).toMatchObject({
            kind: 'RECURRING',
            frequency: 'WEEKLY',
            until: new Date('2027-01-10T00:00:00.000Z'),
        });
    });

    it.each([
        ['tipo de série desconhecido', { kind: 'X' }],
        ['frequência desconhecida', { frequency: 'DAILY' }],
        ['quantidade zero', { count: 0 }],
        ['quantidade fracionada', { count: 1.5 }],
        ['data final inválida', { until: 'x' }],
        ['valor com 3 casas', { amount: '1.234' }],
        ['preset que não é UUID', { presetId: 'x' }],
    ])('rejeita %s', (_label, overrides) => {
        expect(createSeriesSchema.safeParse({ ...valid, ...overrides }).success).toBe(false);
    });
});

describe('extendSeriesSchema', () => {
    it('aceita quantidade ou data final (o domínio exige exatamente um)', () => {
        expect(extendSeriesSchema.parse({ count: 2 })).toEqual({ count: 2 });
        expect(extendSeriesSchema.parse({ until: '2027-06-10' })).toEqual({
            until: new Date('2027-06-10T00:00:00.000Z'),
        });
        expect(extendSeriesSchema.safeParse({ count: 0 }).success).toBe(false);
    });
});

describe('listSeriesQuerySchema', () => {
    it('combina paginação com o filtro de tipo', () => {
        expect(listSeriesQuerySchema.parse({ kind: 'RECURRING' })).toEqual({
            kind: 'RECURRING',
            page: 1,
            pageSize: 10,
        });
        expect(listSeriesQuerySchema.safeParse({ kind: 'X' }).success).toBe(false);
    });
});
