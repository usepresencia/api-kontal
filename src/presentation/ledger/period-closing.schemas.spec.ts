import { closePeriodSchema } from '@/presentation/ledger/period-closing.schemas.js';

const uuid = '3f6d0a2e-8b1c-4f5e-9a7d-1c2b3a4d5e6f';

describe('closePeriodSchema', () => {
    it('aceita o mês com plano e conta de lucros opcionais', () => {
        expect(closePeriodSchema.parse({ month: '2026-09' })).toEqual({ month: '2026-09' });
        expect(
            closePeriodSchema.parse({
                month: '2026-12',
                billingPlanId: uuid,
                retainedEarningsAccountId: uuid,
            }),
        ).toEqual({
            month: '2026-12',
            billingPlanId: uuid,
            retainedEarningsAccountId: uuid,
        });
    });

    it.each([
        {},
        { month: '2026-13' },
        { month: '2026-00' },
        { month: '2026-9' },
        { month: '09/2026' },
        { month: '2026-09-30' },
        { month: '2026-09', billingPlanId: 'x' },
        { month: '2026-12', retainedEarningsAccountId: 'x' },
    ])('rejeita %j', body => {
        expect(closePeriodSchema.safeParse(body).success).toBe(false);
    });
});
