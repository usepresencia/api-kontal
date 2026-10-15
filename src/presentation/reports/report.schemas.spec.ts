import { dreQuerySchema } from '@/presentation/reports/report.schemas.js';

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
