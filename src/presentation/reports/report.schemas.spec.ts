import {
    balanceSheetQuerySchema,
    dailyJournalQuerySchema,
    dreQuerySchema,
    trialBalanceQuerySchema,
} from '@/presentation/reports/report.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

describe('dreQuerySchema', () => {
    it('converte as datas e aceita plano e agrupamento mensal', () => {
        expect(
            dreQuerySchema.parse({
                start: '2026-10-01',
                end: '2026-10-31',
                billingPlanId: uuid,
                groupBy: 'month',
            }),
        ).toEqual({
            start: new Date('2026-10-01T00:00:00.000Z'),
            end: new Date('2026-10-31T00:00:00.000Z'),
            billingPlanId: uuid,
            groupBy: 'month',
        });
        expect(
            dreQuerySchema.parse({ start: '2026-10-01', end: '2026-10-31' }).billingPlanId,
        ).toBeUndefined();
    });

    it.each([
        ['sem início', { end: '2026-10-31' }],
        ['sem fim', { start: '2026-10-01' }],
        ['data em formato brasileiro', { start: '01/10/2026', end: '2026-10-31' }],
        ['data inexistente', { start: '2026-10-01', end: '2026-13-45' }],
        ['plano que não é UUID', { start: '2026-10-01', end: '2026-10-31', billingPlanId: 'x' }],
        ['agrupamento desconhecido', { start: '2026-10-01', end: '2026-10-31', groupBy: 'year' }],
    ])('rejeita %s', (_label, query) => {
        expect(dreQuerySchema.safeParse(query).success).toBe(false);
    });
});

describe('trialBalanceQuerySchema', () => {
    it('aceita maxLevel de 1 a 5 convertido em número e o deixa opcional', () => {
        const base = { start: '2026-10-01', end: '2026-10-31' };
        expect(trialBalanceQuerySchema.parse({ ...base, maxLevel: '2' }).maxLevel).toBe(2);
        expect(trialBalanceQuerySchema.parse(base).maxLevel).toBeUndefined();
        for (const maxLevel of ['0', '6', '1.5', 'x']) {
            expect(trialBalanceQuerySchema.safeParse({ ...base, maxLevel }).success).toBe(false);
        }
    });
});

describe('balanceSheetQuerySchema', () => {
    it('exige a data e aceita plano opcional', () => {
        expect(balanceSheetQuerySchema.parse({ date: '2026-10-31' })).toEqual({
            date: new Date('2026-10-31T00:00:00.000Z'),
        });
        expect(balanceSheetQuerySchema.safeParse({}).success).toBe(false);
        expect(balanceSheetQuerySchema.safeParse({ date: '31/10/2026' }).success).toBe(false);
        expect(
            balanceSheetQuerySchema.safeParse({ date: '2026-10-31', billingPlanId: 'x' }).success,
        ).toBe(false);
    });
});

describe('dailyJournalQuerySchema', () => {
    const base = { start: '2026-10-01', end: '2026-10-31' };

    it('pagina dias: pageSize padrão 7, de 1 a 31', () => {
        expect(dailyJournalQuerySchema.parse(base)).toMatchObject({ page: 1, pageSize: 7 });
        expect(dailyJournalQuerySchema.parse({ ...base, pageSize: '31' }).pageSize).toBe(31);
        expect(dailyJournalQuerySchema.safeParse({ ...base, pageSize: '32' }).success).toBe(false);
        expect(dailyJournalQuerySchema.safeParse({ ...base, page: '0' }).success).toBe(false);
    });
});
